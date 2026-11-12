ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS parts_is_estimate boolean NOT NULL DEFAULT false;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS closure_reason text;

-- Immutability: quote revisions are new rows; responses and confirmations cannot be rewritten.
DROP TRIGGER IF EXISTS quotes_immutable ON public.quotes;
CREATE TRIGGER quotes_immutable BEFORE UPDATE OR DELETE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.reject_mutation();
DROP TRIGGER IF EXISTS responses_immutable ON public.request_responses;
CREATE TRIGGER responses_immutable BEFORE UPDATE OR DELETE ON public.request_responses FOR EACH ROW EXECUTE FUNCTION public.reject_mutation();
DROP TRIGGER IF EXISTS completion_immutable ON public.completion_confirmations;
CREATE TRIGGER completion_immutable BEFORE UPDATE OR DELETE ON public.completion_confirmations FOR EACH ROW EXECUTE FUNCTION public.reject_mutation();

CREATE OR REPLACE FUNCTION public.guard_request_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.customer_id<>OLD.customer_id OR NEW.is_demo<>OLD.is_demo THEN RAISE EXCEPTION 'Ownership and demonstration mode cannot change'; END IF;
  IF NEW.status=OLD.status THEN RETURN NEW; END IF;
  IF NEW.is_demo AND NEW.status<>'cancelled' THEN RAISE EXCEPTION 'Demo requests cannot become real jobs'; END IF;
  IF NOT ((OLD.status='submitted' AND NEW.status IN ('accepted','cancelled'))
    OR (OLD.status='accepted' AND NEW.status IN ('quoted','cancelled','disputed'))
    OR (OLD.status='quoted' AND NEW.status IN ('approved','cancelled','disputed'))
    OR (OLD.status='approved' AND NEW.status IN ('in_progress','disputed'))
    OR (OLD.status='in_progress' AND NEW.status IN ('awaiting_completion','disputed'))
    OR (OLD.status='awaiting_completion' AND NEW.status IN ('completed','disputed'))
    OR (OLD.status='disputed' AND (NEW.status='cancelled' OR NEW.status=OLD.disputed_from_status))) THEN
    RAISE EXCEPTION 'Invalid job transition';
  END IF;
  IF NEW.status='disputed' AND NEW.disputed_from_status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Dispute must record the prior status'; END IF;
  IF NEW.status IN ('approved','in_progress','awaiting_completion','completed') AND NOT EXISTS(SELECT 1 FROM public.approved_quotes WHERE request_id=NEW.id) THEN RAISE EXCEPTION 'Approved quote required'; END IF;
  IF NEW.status='completed' AND (NOT EXISTS(SELECT 1 FROM public.completion_confirmations WHERE request_id=NEW.id AND user_id=NEW.customer_id) OR NOT EXISTS(SELECT 1 FROM public.completion_confirmations c JOIN public.approved_quotes a ON a.request_id=c.request_id JOIN public.quotes q ON q.id=a.quote_id WHERE c.request_id=NEW.id AND c.user_id=q.provider_id)) THEN RAISE EXCEPTION 'Both parties must confirm completion'; END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.marketplace_assigned_provider(p_request_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT provider_id FROM public.request_responses WHERE request_id=p_request_id AND decision='accepted' ORDER BY created_at LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.marketplace_submit_quote(p_request_id uuid, p_scope text, p_callout_cents bigint, p_labour_cents bigint, p_parts_cents bigint, p_parts_is_estimate boolean, p_assumptions text, p_timing text, p_expires_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_req public.service_requests%ROWTYPE; v_id uuid; v_version int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'provider') OR NOT public.has_consent() THEN RAISE EXCEPTION 'Provider account and privacy consent required'; END IF;
  SELECT * INTO v_req FROM public.service_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR v_req.is_demo OR v_req.status NOT IN ('accepted','quoted') THEN RAISE EXCEPTION 'A quote cannot be sent at this stage'; END IF;
  IF public.marketplace_assigned_provider(p_request_id) IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the accepting provider can quote'; END IF;
  IF char_length(trim(coalesce(p_scope,''))) NOT BETWEEN 20 AND 3000 OR char_length(trim(coalesce(p_assumptions,''))) NOT BETWEEN 3 AND 2000 OR char_length(trim(coalesce(p_timing,''))) NOT BETWEEN 3 AND 300 THEN RAISE EXCEPTION 'Check the quote scope, assumptions and timing'; END IF;
  IF p_callout_cents IS NULL OR p_labour_cents IS NULL OR p_parts_cents IS NULL OR p_callout_cents<0 OR p_labour_cents<0 OR p_parts_cents<0 OR p_callout_cents+p_labour_cents+p_parts_cents<=0 OR p_callout_cents+p_labour_cents+p_parts_cents>100000000000 THEN RAISE EXCEPTION 'Quote amounts are invalid'; END IF;
  IF p_expires_at IS NOT NULL AND p_expires_at<=now() THEN RAISE EXCEPTION 'Quote expiry must be in the future'; END IF;
  SELECT coalesce(max(version),0)+1 INTO v_version FROM public.quotes WHERE request_id=p_request_id;
  INSERT INTO public.quotes(request_id,provider_id,scope,callout_cents,labour_cents,parts_cents,total_cents,parts_is_estimate,assumptions,timing,expires_at,version)
  VALUES(p_request_id,auth.uid(),trim(p_scope),p_callout_cents,p_labour_cents,p_parts_cents,p_callout_cents+p_labour_cents+p_parts_cents,coalesce(p_parts_is_estimate,false),trim(p_assumptions),trim(p_timing),p_expires_at,v_version) RETURNING id INTO v_id;
  IF v_req.status='accepted' THEN UPDATE public.service_requests SET status='quoted',updated_at=now() WHERE id=p_request_id; END IF;
  INSERT INTO public.request_events(request_id,actor_id,status,note) VALUES(p_request_id,auth.uid(),'quoted',CASE WHEN v_version=1 THEN 'Provider sent an itemised quote.' ELSE 'Provider sent a revised quote (version '||v_version||').' END);
  INSERT INTO public.audit_events(actor_id,action,entity_id,details) VALUES(auth.uid(),'quote_submitted',p_request_id,jsonb_build_object('quote_id',v_id,'version',v_version,'total_cents',p_callout_cents+p_labour_cents+p_parts_cents));
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.marketplace_approve_quote(p_request_id uuid, p_quote_id uuid, p_scope_confirmed boolean, p_price_confirmed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_req public.service_requests%ROWTYPE; v_q public.quotes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_consent() THEN RAISE EXCEPTION 'Sign in and consent required'; END IF;
  IF p_scope_confirmed IS DISTINCT FROM true OR p_price_confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Confirm both the scope and the price'; END IF;
  SELECT * INTO v_req FROM public.service_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR v_req.customer_id<>auth.uid() THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status<>'quoted' THEN RAISE EXCEPTION 'This quote can no longer be approved'; END IF;
  SELECT * INTO v_q FROM public.quotes WHERE id=p_quote_id AND request_id=p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quote not found'; END IF;
  IF v_q.version<>(SELECT max(version) FROM public.quotes WHERE request_id=p_request_id) THEN RAISE EXCEPTION 'A newer quote version exists; review it first'; END IF;
  IF v_q.expires_at IS NOT NULL AND v_q.expires_at<=now() THEN RAISE EXCEPTION 'This quote has expired'; END IF;
  INSERT INTO public.approved_quotes(request_id,quote_id,customer_id,snapshot) VALUES(p_request_id,p_quote_id,auth.uid(),
    jsonb_build_object('version',v_q.version,'provider_id',v_q.provider_id,'scope',v_q.scope,'callout_cents',v_q.callout_cents,'labour_cents',v_q.labour_cents,'parts_cents',v_q.parts_cents,'parts_is_estimate',v_q.parts_is_estimate,'total_cents',v_q.total_cents,'assumptions',v_q.assumptions,'timing',v_q.timing,'quoted_at',v_q.created_at,'scope_confirmed',true,'price_confirmed',true));
  UPDATE public.service_requests SET status='approved',updated_at=now() WHERE id=p_request_id;
  INSERT INTO public.request_events(request_id,actor_id,status,note) VALUES(p_request_id,auth.uid(),'approved','Customer approved the quote scope and price. Contact details are now shared with the provider.');
  INSERT INTO public.audit_events(actor_id,action,entity_id,details) VALUES(auth.uid(),'quote_approved',p_request_id,jsonb_build_object('quote_id',p_quote_id,'total_cents',v_q.total_cents));
END $$;

CREATE OR REPLACE FUNCTION public.marketplace_advance_job(p_request_id uuid, p_to text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_req public.service_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_consent() THEN RAISE EXCEPTION 'Sign in and consent required'; END IF;
  SELECT * INTO v_req FROM public.service_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR public.marketplace_assigned_provider(p_request_id) IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Only the assigned provider can update this job'; END IF;
  IF NOT ((v_req.status='approved' AND p_to='in_progress') OR (v_req.status='in_progress' AND p_to='awaiting_completion')) THEN RAISE EXCEPTION 'Invalid job transition'; END IF;
  UPDATE public.service_requests SET status=p_to,updated_at=now() WHERE id=p_request_id;
  INSERT INTO public.request_events(request_id,actor_id,status,note) VALUES(p_request_id,auth.uid(),p_to,CASE WHEN p_to='in_progress' THEN 'Provider started the work.' ELSE 'Provider marked the work complete; both parties must confirm.' END);
  INSERT INTO public.audit_events(actor_id,action,entity_id,details) VALUES(auth.uid(),'job_status_changed',p_request_id,jsonb_build_object('from',v_req.status,'to',p_to));
END $$;

CREATE OR REPLACE FUNCTION public.marketplace_confirm_completion(p_request_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_req public.service_requests%ROWTYPE; v_provider uuid; v_party text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_consent() THEN RAISE EXCEPTION 'Sign in and consent required'; END IF;
  SELECT * INTO v_req FROM public.service_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  v_provider := public.marketplace_assigned_provider(p_request_id);
  IF auth.uid()=v_req.customer_id THEN v_party:='customer'; ELSIF auth.uid()=v_provider THEN v_party:='provider'; ELSE RAISE EXCEPTION 'Only the customer or assigned provider can confirm'; END IF;
  IF v_req.status<>'awaiting_completion' THEN RAISE EXCEPTION 'Completion cannot be confirmed at this stage'; END IF;
  IF EXISTS(SELECT 1 FROM public.completion_confirmations WHERE request_id=p_request_id AND user_id=auth.uid()) THEN RAISE EXCEPTION 'You have already confirmed completion'; END IF;
  INSERT INTO public.completion_confirmations(request_id,user_id) VALUES(p_request_id,auth.uid());
  INSERT INTO public.audit_events(actor_id,action,entity_id,details) VALUES(auth.uid(),'completion_confirmed',p_request_id,jsonb_build_object('party',v_party));
  IF EXISTS(SELECT 1 FROM public.completion_confirmations WHERE request_id=p_request_id AND user_id=v_req.customer_id) AND EXISTS(SELECT 1 FROM public.completion_confirmations WHERE request_id=p_request_id AND user_id=v_provider) THEN
    UPDATE public.service_requests SET status='completed',updated_at=now() WHERE id=p_request_id;
    INSERT INTO public.request_events(request_id,actor_id,status,note) VALUES(p_request_id,auth.uid(),'completed','Both parties confirmed completion.');
    RETURN 'completed';
  END IF;
  INSERT INTO public.request_events(request_id,actor_id,status,note) VALUES(p_request_id,auth.uid(),'awaiting_completion',initcap(v_party)||' confirmed completion; waiting for the other party.');
  RETURN 'awaiting_other_party';
END $$;

CREATE OR REPLACE FUNCTION public.marketplace_cancel_job(p_request_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_req public.service_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_consent() THEN RAISE EXCEPTION 'Sign in and consent required'; END IF;
  IF char_length(trim(coalesce(p_reason,''))) NOT BETWEEN 5 AND 1000 THEN RAISE EXCEPTION 'Give a cancellation reason'; END IF;
  SELECT * INTO v_req FROM public.service_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR (auth.uid()<>v_req.customer_id AND auth.uid() IS DISTINCT FROM public.marketplace_assigned_provider(p_request_id)) THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status NOT IN ('accepted','quoted') THEN RAISE EXCEPTION 'After quote approval, use a dispute or support case instead'; END IF;
  UPDATE public.service_requests SET status='cancelled',closure_reason=trim(p_reason),updated_at=now() WHERE id=p_request_id;
  INSERT INTO public.request_events(request_id,actor_id,status,note) VALUES(p_request_id,auth.uid(),'cancelled','Cancelled: '||trim(p_reason));
  INSERT INTO public.audit_events(actor_id,action,entity_id,details) VALUES(auth.uid(),'job_cancelled',p_request_id,jsonb_build_object('from',v_req.status));
END $$;

CREATE OR REPLACE FUNCTION public.marketplace_open_dispute(p_request_id uuid, p_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_req public.service_requests%ROWTYPE; v_case uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_consent() THEN RAISE EXCEPTION 'Sign in and consent required'; END IF;
  IF char_length(trim(coalesce(p_reason,''))) NOT BETWEEN 20 AND 3000 THEN RAISE EXCEPTION 'Describe the disagreement in at least 20 characters'; END IF;
  SELECT * INTO v_req FROM public.service_requests WHERE id=p_request_id FOR UPDATE;
  IF NOT FOUND OR (auth.uid()<>v_req.customer_id AND auth.uid() IS DISTINCT FROM public.marketplace_assigned_provider(p_request_id)) THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status NOT IN ('accepted','quoted','approved','in_progress','awaiting_completion') THEN RAISE EXCEPTION 'A dispute cannot be opened at this stage'; END IF;
  UPDATE public.service_requests SET status='disputed',disputed_from_status=v_req.status,updated_at=now() WHERE id=p_request_id;
  INSERT INTO public.support_cases(request_id,opened_by,kind,description) VALUES(p_request_id,auth.uid(),'completion',trim(p_reason)) RETURNING id INTO v_case;
  INSERT INTO public.request_events(request_id,actor_id,status,note) VALUES(p_request_id,auth.uid(),'disputed','A dispute was opened; the job is paused until support resolves it.');
  INSERT INTO public.audit_events(actor_id,action,entity_id,details) VALUES(auth.uid(),'dispute_opened',p_request_id,jsonb_build_object('case_id',v_case,'from',v_req.status));
  RETURN v_case;
END $$;

CREATE OR REPLACE FUNCTION public.open_support_case(p_request_id uuid, p_kind text, p_description text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_case uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_consent() THEN RAISE EXCEPTION 'Sign in and consent required'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('false_profile','workmanship','safety','payment','completion','commission','cancellation','fraud','privacy') THEN RAISE EXCEPTION 'Choose a support topic'; END IF;
  IF char_length(trim(coalesce(p_description,''))) NOT BETWEEN 20 AND 3000 THEN RAISE EXCEPTION 'Describe the issue in at least 20 characters'; END IF;
  IF p_request_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.service_requests r WHERE r.id=p_request_id AND (r.customer_id=auth.uid() OR public.marketplace_assigned_provider(r.id)=auth.uid())) THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF (SELECT count(*) FROM public.support_cases WHERE opened_by=auth.uid() AND created_at>now()-interval '1 hour')>=5 THEN RAISE EXCEPTION 'Limit of 5 support cases per hour reached'; END IF;
  INSERT INTO public.support_cases(request_id,opened_by,kind,description) VALUES(p_request_id,auth.uid(),p_kind,trim(p_description)) RETURNING id INTO v_case;
  INSERT INTO public.audit_events(actor_id,action,entity_id,details) VALUES(auth.uid(),'support_case_opened',v_case,jsonb_build_object('kind',p_kind,'request_id',p_request_id));
  RETURN v_case;
END $$;

CREATE OR REPLACE FUNCTION public.admin_resolve_support_case(p_case_id uuid, p_note text, p_dispute_outcome text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_case public.support_cases%ROWTYPE; v_req public.service_requests%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Authorised admin access required'; END IF;
  IF char_length(trim(coalesce(p_note,''))) NOT BETWEEN 5 AND 2000 THEN RAISE EXCEPTION 'Add a resolution reason'; END IF;
  SELECT * INTO v_case FROM public.support_cases WHERE id=p_case_id FOR UPDATE;
  IF NOT FOUND OR v_case.status<>'open' THEN RAISE EXCEPTION 'This case is not open'; END IF;
  IF v_case.request_id IS NOT NULL THEN
    SELECT * INTO v_req FROM public.service_requests WHERE id=v_case.request_id FOR UPDATE;
    IF v_req.status='disputed' THEN
      IF p_dispute_outcome='resume' THEN
        UPDATE public.service_requests SET status=v_req.disputed_from_status,updated_at=now() WHERE id=v_req.id;
      ELSIF p_dispute_outcome='cancel' THEN
        UPDATE public.service_requests SET status='cancelled',closure_reason=trim(p_note),updated_at=now() WHERE id=v_req.id;
      ELSE RAISE EXCEPTION 'Choose whether the disputed job resumes or is cancelled'; END IF;
      INSERT INTO public.request_events(request_id,actor_id,status,note) VALUES(v_req.id,auth.uid(),CASE WHEN p_dispute_outcome='resume' THEN v_req.disputed_from_status ELSE 'cancelled' END,'Support resolved the dispute: '||trim(p_note));
    END IF;
  END IF;
  UPDATE public.support_cases SET status='resolved',resolution_note=trim(p_note),resolved_at=now(),resolved_by=auth.uid() WHERE id=p_case_id;
  INSERT INTO public.audit_events(actor_id,action,entity_id,details) VALUES(auth.uid(),'support_case_resolved',p_case_id,jsonb_build_object('request_id',v_case.request_id,'dispute_outcome',p_dispute_outcome));
END $$;

DROP POLICY IF EXISTS admin_requests_read ON public.service_requests;
CREATE POLICY admin_requests_read ON public.service_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

REVOKE ALL ON FUNCTION public.marketplace_assigned_provider(uuid), public.marketplace_submit_quote(uuid,text,bigint,bigint,bigint,boolean,text,text,timestamptz), public.marketplace_approve_quote(uuid,uuid,boolean,boolean), public.marketplace_advance_job(uuid,text), public.marketplace_confirm_completion(uuid), public.marketplace_cancel_job(uuid,text), public.marketplace_open_dispute(uuid,text), public.open_support_case(uuid,text,text), public.admin_resolve_support_case(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_assigned_provider(uuid), public.marketplace_submit_quote(uuid,text,bigint,bigint,bigint,boolean,text,text,timestamptz), public.marketplace_approve_quote(uuid,uuid,boolean,boolean), public.marketplace_advance_job(uuid,text), public.marketplace_confirm_completion(uuid), public.marketplace_cancel_job(uuid,text), public.marketplace_open_dispute(uuid,text), public.open_support_case(uuid,text,text), public.admin_resolve_support_case(uuid,text,text) TO authenticated;