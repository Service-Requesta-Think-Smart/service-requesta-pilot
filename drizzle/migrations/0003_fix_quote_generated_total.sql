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
  INSERT INTO public.quotes(request_id,provider_id,scope,callout_cents,labour_cents,parts_cents,parts_is_estimate,assumptions,timing,expires_at,version)
  VALUES(p_request_id,auth.uid(),trim(p_scope),p_callout_cents,p_labour_cents,p_parts_cents,coalesce(p_parts_is_estimate,false),trim(p_assumptions),trim(p_timing),p_expires_at,v_version) RETURNING id INTO v_id;
  IF v_req.status='accepted' THEN UPDATE public.service_requests SET status='quoted',updated_at=now() WHERE id=p_request_id; END IF;
  INSERT INTO public.request_events(request_id,actor_id,status,note) VALUES(p_request_id,auth.uid(),'quoted',CASE WHEN v_version=1 THEN 'Provider sent an itemised quote.' ELSE 'Provider sent a revised quote (version '||v_version||').' END);
  INSERT INTO public.audit_events(actor_id,action,entity_id,details) VALUES(auth.uid(),'quote_submitted',p_request_id,jsonb_build_object('quote_id',v_id,'version',v_version,'total_cents',p_callout_cents+p_labour_cents+p_parts_cents));
  RETURN v_id;
END $$;