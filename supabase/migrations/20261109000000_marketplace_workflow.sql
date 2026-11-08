BEGIN;

-- Live marketplace stays closed until an authorised operator changes every launch flag
-- and a legal-approved commission version is present.
INSERT INTO public.feature_flags (name, enabled)
VALUES
  ('public_bookings', false),
  ('electronic_payments', false),
  ('production_email', false),
  ('commission_enforcement', false),
  ('legal_approval', false)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.request_private_details (
  request_id uuid PRIMARY KEY REFERENCES public.service_requests(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  service_address text NOT NULL CHECK (char_length(trim(service_address)) BETWEEN 8 AND 300),
  contact_phone text NOT NULL CHECK (contact_phone ~ '^\+27[0-9]{9}$'),
  shared_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.request_private_details ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.request_private_details FROM PUBLIC, anon;
GRANT SELECT ON public.request_private_details TO authenticated;
DROP POLICY IF EXISTS request_private_details_owner ON public.request_private_details;
CREATE POLICY request_private_details_owner ON public.request_private_details
  FOR SELECT TO authenticated USING (customer_id = auth.uid() AND public.has_consent());

ALTER TABLE public.completion_confirmations
  ADD COLUMN IF NOT EXISTS final_amount_cents bigint,
  ADD COLUMN IF NOT EXISTS payment_method text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'completion_amount_cents_check') THEN
    ALTER TABLE public.completion_confirmations
      ADD CONSTRAINT completion_amount_cents_check
      CHECK (final_amount_cents IS NULL OR final_amount_cents BETWEEN 0 AND 100000000000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'completion_payment_method_check') THEN
    ALTER TABLE public.completion_confirmations
      ADD CONSTRAINT completion_payment_method_check
      CHECK (payment_method IS NULL OR payment_method IN ('cash'));
  END IF;
END
$$;

ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS disputed_from_status text;
ALTER TABLE public.support_cases
  ADD COLUMN IF NOT EXISTS resolution_note text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.fee_notices
  ADD COLUMN IF NOT EXISTS dispute_note text,
  ADD COLUMN IF NOT EXISTS disputed_at timestamptz;

CREATE OR REPLACE FUNCTION public.marketplace_is_open()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND public.has_consent()
    AND EXISTS (SELECT 1 FROM public.feature_flags WHERE name = 'public_bookings' AND enabled)
    AND EXISTS (SELECT 1 FROM public.feature_flags WHERE name = 'legal_approval' AND enabled)
    AND EXISTS (SELECT 1 FROM public.feature_flags WHERE name = 'commission_enforcement' AND enabled)
    AND EXISTS (
      SELECT 1 FROM public.commission_versions
      WHERE legal_approved
        AND rate_bps BETWEEN 0 AND 10000
        AND base_definition = 'approved_quote_total_cents'
    )
$function$;
REVOKE ALL ON FUNCTION public.marketplace_is_open() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_is_open() TO authenticated;

CREATE OR REPLACE FUNCTION public.provider_can_see_open(p_request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT public.has_role(auth.uid(), 'provider')
    AND public.has_consent()
    AND EXISTS (
      SELECT 1
      FROM public.service_requests AS request
      JOIN public.provider_profiles AS provider
        ON provider.user_id = auth.uid()
       AND provider.category = request.category
       AND lower(btrim(provider.area)) = lower(btrim(request.area))
       AND provider.application_status = 'approved'
       AND provider.identity_status = 'checked'
       AND provider.trade_status = 'reviewed'
      WHERE request.id = p_request_id
        AND NOT request.is_demo
        AND (
          (
            request.status = 'submitted'
            AND public.marketplace_is_open()
            AND NOT EXISTS (
              SELECT 1 FROM public.request_responses AS response
              WHERE response.request_id = request.id AND response.provider_id = auth.uid()
            )
          )
          OR (
            request.status IN ('accepted','quoted','approved','in_progress','awaiting_completion','completed','disputed')
            AND EXISTS (
              SELECT 1 FROM public.request_responses AS response
              WHERE response.request_id = request.id
                AND response.provider_id = auth.uid()
                AND response.decision = 'accepted'
            )
          )
        )
    )
$function$;
REVOKE ALL ON FUNCTION public.provider_can_see_open(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_can_see_open(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.marketplace_create_request(
  p_category text,
  p_title text,
  p_description text,
  p_area text,
  p_timing text,
  p_service_address text,
  p_contact_phone text,
  p_share_private_details boolean,
  p_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_email_confirmed_at timestamptz;
  v_id uuid;
BEGIN
  IF v_user_id IS NULL OR NOT public.has_role(v_user_id, 'customer') OR NOT public.has_consent() THEN
    RAISE EXCEPTION 'Customer account and privacy consent required';
  END IF;
  IF NOT public.marketplace_is_open() THEN
    RAISE EXCEPTION 'Live marketplace is not open';
  END IF;
  SELECT email_confirmed_at INTO v_email_confirmed_at FROM auth.users WHERE id = v_user_id;
  IF v_email_confirmed_at IS NULL THEN RAISE EXCEPTION 'A verified email address is required'; END IF;
  IF p_category IS NULL OR p_category NOT IN ('plumbing','electrical','motor_mechanics')
    OR char_length(trim(coalesce(p_title,''))) NOT BETWEEN 5 AND 120
    OR char_length(trim(coalesce(p_description,''))) NOT BETWEEN 20 AND 2000
    OR char_length(trim(coalesce(p_area,''))) NOT BETWEEN 2 AND 100
    OR p_timing IS NULL OR p_timing NOT IN ('flexible','this_week','as_soon_as_possible') THEN
    RAISE EXCEPTION 'Check the service request details';
  END IF;
  IF p_share_private_details IS DISTINCT FROM true
    OR char_length(trim(coalesce(p_service_address,''))) NOT BETWEEN 8 AND 300
    OR p_contact_phone IS NULL OR p_contact_phone !~ '^\+27[0-9]{9}$' OR p_key IS NULL THEN
    RAISE EXCEPTION 'Separate consent and valid service contact details are required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  SELECT id INTO v_id
  FROM public.service_requests
  WHERE customer_id = v_user_id AND idempotency_key = p_key AND NOT is_demo;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  IF EXISTS (
    SELECT 1 FROM public.service_requests
    WHERE customer_id = v_user_id AND idempotency_key = p_key AND is_demo
  ) THEN RAISE EXCEPTION 'Request key has already been used'; END IF;
  IF (SELECT count(*) FROM public.service_requests
      WHERE customer_id = v_user_id AND created_at > now() - interval '1 hour') >= 5 THEN
    RAISE EXCEPTION 'Limit of 5 requests per hour reached';
  END IF;

  INSERT INTO public.service_requests (
    customer_id, category, title, description, area, timing, idempotency_key, is_demo
  ) VALUES (
    v_user_id, p_category, trim(p_title), trim(p_description), trim(p_area), p_timing, p_key, false
  ) RETURNING id INTO v_id;

  INSERT INTO public.request_private_details(request_id, customer_id, service_address, contact_phone)
  VALUES (v_id, v_user_id, trim(p_service_address), p_contact_phone);
  INSERT INTO public.request_events(request_id, actor_id, status, note)
  VALUES (v_id, v_user_id, 'submitted', 'Marketplace request submitted with private contact details.');
  INSERT INTO public.audit_events(actor_id, action, entity_id, details)
  VALUES (v_user_id, 'marketplace_request_created', v_id, jsonb_build_object('category', p_category));
  RETURN v_id;
END
$function$;
REVOKE ALL ON FUNCTION public.marketplace_create_request(text,text,text,text,text,text,text,boolean,uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_create_request(text,text,text,text,text,text,text,boolean,uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.marketplace_get_provider_contact(p_request_id uuid)
RETURNS TABLE (service_address text, contact_phone text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'provider') OR NOT public.has_consent() THEN
    RAISE EXCEPTION 'Provider access required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.approved_quotes approved
    JOIN public.quotes quote ON quote.id = approved.quote_id
    JOIN public.service_requests request ON request.id = approved.request_id
    WHERE approved.request_id = p_request_id
      AND quote.provider_id = auth.uid()
      AND request.status IN ('approved','in_progress','awaiting_completion','completed','disputed')
  ) THEN
    RAISE EXCEPTION 'Customer contact details are available only after quote approval';
  END IF;
  RETURN QUERY
  SELECT details.service_address, details.contact_phone
  FROM public.request_private_details details
  WHERE details.request_id = p_request_id;
END
$function$;
REVOKE ALL ON FUNCTION public.marketplace_get_provider_contact(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_get_provider_contact(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.marketplace_respond_to_request(p_request_id uuid, p_decision text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_request public.service_requests%ROWTYPE;
  v_email_confirmed_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'provider') OR NOT public.has_consent() THEN
    RAISE EXCEPTION 'Provider account and privacy consent required';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('accepted','declined') THEN RAISE EXCEPTION 'Invalid response'; END IF;
  SELECT email_confirmed_at INTO v_email_confirmed_at FROM auth.users WHERE id = auth.uid();
  IF v_email_confirmed_at IS NULL THEN RAISE EXCEPTION 'A verified email address is required'; END IF;

  SELECT * INTO v_request FROM public.service_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.is_demo OR v_request.status <> 'submitted' OR NOT public.marketplace_is_open() THEN
    RAISE EXCEPTION 'This request is no longer available';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.provider_profiles provider
    WHERE provider.user_id = auth.uid()
      AND provider.category = v_request.category
      AND lower(btrim(provider.area)) = lower(btrim(v_request.area))
      AND provider.application_status = 'approved'
      AND provider.identity_status = 'checked'
      AND provider.trade_status = 'reviewed'
  ) THEN RAISE EXCEPTION 'Approved matching provider application required'; END IF;
  IF EXISTS (SELECT 1 FROM public.request_responses WHERE request_id = p_request_id AND provider_id = auth.uid()) THEN
    RAISE EXCEPTION 'You have already responded to this request';
  END IF;

  INSERT INTO public.request_responses(request_id, provider_id, decision)
  VALUES (p_request_id, auth.uid(), p_decision);
  IF p_decision = 'accepted' THEN
    UPDATE public.service_requests SET status = 'accepted', updated_at = now() WHERE id = p_request_id;
  END IF;
  INSERT INTO public.request_events(request_id, actor_id, status, note)
  VALUES (p_request_id, auth.uid(), CASE WHEN p_decision = 'accepted' THEN 'accepted' ELSE 'submitted' END,
          CASE WHEN p_decision = 'accepted' THEN 'A matching provider accepted the request.' ELSE 'A matching provider declined the request.' END);
  INSERT INTO public.audit_events(actor_id, action, entity_id, details)
  VALUES (auth.uid(), 'marketplace_provider_response', p_request_id, jsonb_build_object('decision', p_decision));
END
$function$;
REVOKE ALL ON FUNCTION public.marketplace_respond_to_request(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_respond_to_request(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.marketplace_submit_quote(
  p_request_id uuid,
  p_scope text,
  p_labour_cents bigint,
  p_callout_cents bigint,
  p_parts_cents bigint,
  p_assumptions text,
  p_timing text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_request public.service_requests%ROWTYPE;
  v_quote_id uuid;
  v_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'provider') OR NOT public.has_consent() THEN
    RAISE EXCEPTION 'Provider account and privacy consent required';
  END IF;
  SELECT * INTO v_request FROM public.service_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.is_demo OR v_request.status NOT IN ('accepted','quoted') THEN
    RAISE EXCEPTION 'This request cannot receive a quote';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.request_responses
    WHERE request_id = p_request_id AND provider_id = auth.uid() AND decision = 'accepted'
  ) THEN RAISE EXCEPTION 'Only the accepting provider can quote'; END IF;
  IF NOT public.marketplace_is_open() THEN RAISE EXCEPTION 'Live marketplace is not open'; END IF;
  IF char_length(trim(coalesce(p_scope,''))) NOT BETWEEN 20 AND 3000
    OR char_length(trim(coalesce(p_assumptions,''))) NOT BETWEEN 2 AND 2000
    OR char_length(trim(coalesce(p_timing,''))) NOT BETWEEN 2 AND 500
    OR p_labour_cents IS NULL OR p_labour_cents NOT BETWEEN 0 AND 100000000000
    OR p_callout_cents IS NULL OR p_callout_cents NOT BETWEEN 0 AND 100000000000
    OR p_parts_cents IS NULL OR p_parts_cents NOT BETWEEN 0 AND 100000000000
    OR p_labour_cents::numeric + p_callout_cents::numeric + p_parts_cents::numeric > 100000000000 THEN
    RAISE EXCEPTION 'Check quote scope, timing, assumptions, and amounts';
  END IF;
  SELECT count(*) INTO v_count FROM public.quotes WHERE request_id = p_request_id;
  IF v_count >= 3 THEN RAISE EXCEPTION 'Quote revision limit reached'; END IF;
  IF EXISTS (SELECT 1 FROM public.approved_quotes WHERE request_id = p_request_id) THEN
    RAISE EXCEPTION 'An approved quote cannot be changed';
  END IF;

  INSERT INTO public.quotes(request_id, provider_id, scope, labour_cents, callout_cents, parts_cents, assumptions, timing)
  VALUES (p_request_id, auth.uid(), trim(p_scope), p_labour_cents, p_callout_cents, p_parts_cents, trim(p_assumptions), trim(p_timing))
  RETURNING id INTO v_quote_id;

  IF v_request.status = 'accepted' THEN
    UPDATE public.service_requests SET status = 'quoted', updated_at = now() WHERE id = p_request_id;
  END IF;
  INSERT INTO public.request_events(request_id, actor_id, status, note)
  VALUES (p_request_id, auth.uid(), 'quoted', 'A written quote was submitted.');
  INSERT INTO public.audit_events(actor_id, action, entity_id, details)
  VALUES (auth.uid(), 'marketplace_quote_submitted', p_request_id, jsonb_build_object('quote_id', v_quote_id));
  RETURN v_quote_id;
END
$function$;
REVOKE ALL ON FUNCTION public.marketplace_submit_quote(uuid,text,bigint,bigint,bigint,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_submit_quote(uuid,text,bigint,bigint,bigint,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.marketplace_approve_quote(p_request_id uuid, p_quote_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_provider_id uuid;
  v_total_cents bigint;
  v_snapshot jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'customer') OR NOT public.has_consent() THEN
    RAISE EXCEPTION 'Customer account and privacy consent required';
  END IF;
  IF NOT public.marketplace_is_open() THEN RAISE EXCEPTION 'Live marketplace is not open'; END IF;
  PERFORM 1 FROM public.service_requests WHERE id = p_request_id AND customer_id = auth.uid() AND status = 'quoted' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This request is not awaiting quote approval'; END IF;

  SELECT quote.provider_id, quote.total_cents,
    jsonb_build_object(
      'quote_id', quote.id, 'scope', quote.scope, 'labour_cents', quote.labour_cents,
      'callout_cents', quote.callout_cents, 'parts_cents', quote.parts_cents,
      'total_cents', quote.total_cents, 'assumptions', quote.assumptions, 'timing', quote.timing
    )
  INTO v_provider_id, v_total_cents, v_snapshot
  FROM public.quotes quote
  WHERE quote.id = p_quote_id AND quote.request_id = p_request_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Choose a quote for this request'; END IF;
  INSERT INTO public.approved_quotes(request_id, quote_id, customer_id, snapshot)
  VALUES (p_request_id, p_quote_id, auth.uid(), v_snapshot);
  UPDATE public.service_requests SET status = 'approved', updated_at = now() WHERE id = p_request_id;
  INSERT INTO public.request_events(request_id, actor_id, status, note)
  VALUES (p_request_id, auth.uid(), 'approved', 'Customer approved the written scope and total before work.');
  INSERT INTO public.audit_events(actor_id, action, entity_id, details)
  VALUES (auth.uid(), 'marketplace_quote_approved', p_request_id, jsonb_build_object('quote_id', p_quote_id, 'total_cents', v_total_cents));
END
$function$;
REVOKE ALL ON FUNCTION public.marketplace_approve_quote(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_approve_quote(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.marketplace_start_work(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'provider') OR NOT public.has_consent() THEN
    RAISE EXCEPTION 'Provider account and privacy consent required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.approved_quotes WHERE request_id = p_request_id
      AND quote_id IN (SELECT id FROM public.quotes WHERE provider_id = auth.uid())
  ) THEN RAISE EXCEPTION 'Only the selected provider can start this job'; END IF;
  UPDATE public.service_requests SET status = 'in_progress', updated_at = now()
  WHERE id = p_request_id AND status = 'approved' AND NOT is_demo;
  IF NOT FOUND THEN RAISE EXCEPTION 'The approved job cannot be started'; END IF;
  INSERT INTO public.request_events(request_id, actor_id, status, note)
  VALUES (p_request_id, auth.uid(), 'in_progress', 'Provider recorded that work has started.');
END
$function$;
REVOKE ALL ON FUNCTION public.marketplace_start_work(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_start_work(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.marketplace_mark_work_ready(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'provider') OR NOT public.has_consent() THEN
    RAISE EXCEPTION 'Provider account and privacy consent required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.approved_quotes WHERE request_id = p_request_id
      AND quote_id IN (SELECT id FROM public.quotes WHERE provider_id = auth.uid())
  ) THEN RAISE EXCEPTION 'Only the selected provider can mark work ready'; END IF;
  UPDATE public.service_requests SET status = 'awaiting_completion', updated_at = now()
  WHERE id = p_request_id AND status = 'in_progress' AND NOT is_demo;
  IF NOT FOUND THEN RAISE EXCEPTION 'This job is not in progress'; END IF;
  INSERT INTO public.request_events(request_id, actor_id, status, note)
  VALUES (p_request_id, auth.uid(), 'awaiting_completion', 'Provider marked the agreed work ready for confirmation.');
END
$function$;
REVOKE ALL ON FUNCTION public.marketplace_mark_work_ready(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_mark_work_ready(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.marketplace_confirm_completion(p_request_id uuid, p_final_amount_cents bigint, p_payment_method text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_customer_id uuid;
  v_provider_id uuid;
  v_status text;
  v_expected_cents bigint;
  v_customer_amount bigint;
  v_provider_amount bigint;
  v_customer_method text;
  v_provider_method text;
  v_version_id uuid;
  v_ledger_id uuid;
  v_notice_at timestamptz;
BEGIN
  IF v_user_id IS NULL OR NOT public.has_consent() THEN RAISE EXCEPTION 'Sign in and accept privacy notice'; END IF;
  IF p_final_amount_cents IS NULL OR p_final_amount_cents NOT BETWEEN 0 AND 100000000000 OR p_payment_method IS NULL OR p_payment_method <> 'cash' THEN
    RAISE EXCEPTION 'Confirm the agreed amount and recorded cash payment method';
  END IF;
  SELECT request.customer_id, request.status, quote.provider_id, quote.total_cents
  INTO v_customer_id, v_status, v_provider_id, v_expected_cents
  FROM public.service_requests request
  JOIN public.approved_quotes approved ON approved.request_id = request.id
  JOIN public.quotes quote ON quote.id = approved.quote_id
  WHERE request.id = p_request_id AND NOT request.is_demo
  FOR UPDATE OF request;
  IF NOT FOUND OR v_status <> 'awaiting_completion' THEN RAISE EXCEPTION 'This job is not awaiting completion confirmation'; END IF;
  IF v_user_id NOT IN (v_customer_id, v_provider_id) THEN RAISE EXCEPTION 'Only the customer and selected provider can confirm'; END IF;
  IF p_final_amount_cents <> v_expected_cents THEN RAISE EXCEPTION 'The confirmed total must match the approved quote. Open support if the agreed total changed.'; END IF;
  IF EXISTS (SELECT 1 FROM public.feature_flags WHERE name = 'electronic_payments' AND enabled) THEN
    RAISE EXCEPTION 'This build records cash only; electronic payments are not connected';
  END IF;

  INSERT INTO public.completion_confirmations(request_id, user_id, final_amount_cents, payment_method)
  VALUES (p_request_id, v_user_id, p_final_amount_cents, p_payment_method)
  ON CONFLICT (request_id, user_id) DO UPDATE
    SET final_amount_cents = EXCLUDED.final_amount_cents,
        payment_method = EXCLUDED.payment_method,
        confirmed_at = now();

  SELECT final_amount_cents, payment_method INTO v_customer_amount, v_customer_method
  FROM public.completion_confirmations WHERE request_id = p_request_id AND user_id = v_customer_id;
  SELECT final_amount_cents, payment_method INTO v_provider_amount, v_provider_method
  FROM public.completion_confirmations WHERE request_id = p_request_id AND user_id = v_provider_id;

  IF v_customer_amount IS NOT NULL AND v_provider_amount IS NOT NULL THEN
    IF v_customer_amount <> v_provider_amount OR v_customer_method <> v_provider_method THEN
      UPDATE public.service_requests SET disputed_from_status = status, status = 'disputed', updated_at = now() WHERE id = p_request_id;
      INSERT INTO public.support_cases(request_id, opened_by, kind, description)
      VALUES (p_request_id, v_user_id, 'completion', 'The customer and provider completion records do not match. Support review is required.');
      INSERT INTO public.request_events(request_id, actor_id, status, note)
      VALUES (p_request_id, v_user_id, 'disputed', 'Completion records differ; the job was sent for support review.');
      RETURN;
    END IF;

    UPDATE public.service_requests SET status = 'completed', updated_at = now() WHERE id = p_request_id;
    INSERT INTO public.request_events(request_id, actor_id, status, note)
    VALUES (p_request_id, v_user_id, 'completed', 'Both parties confirmed the approved quote total and recorded payment method.');

    IF EXISTS (SELECT 1 FROM public.feature_flags WHERE name = 'commission_enforcement' AND enabled) THEN
      SELECT id INTO v_version_id FROM public.commission_versions
      WHERE legal_approved AND base_definition = 'approved_quote_total_cents'
      ORDER BY created_at DESC LIMIT 1;
      IF v_version_id IS NULL THEN RAISE EXCEPTION 'A legal-approved commission version is required'; END IF;

      INSERT INTO public.commission_ledger(request_id, provider_id, version_id, base_cents, fee_cents)
      SELECT p_request_id, v_provider_id, v_version_id, quote.total_cents,
             public.calculate_commission(quote.total_cents, version.rate_bps)
      FROM public.approved_quotes approved
      JOIN public.quotes quote ON quote.id = approved.quote_id
      JOIN public.commission_versions version ON version.id = v_version_id
      WHERE approved.request_id = p_request_id
      RETURNING id INTO v_ledger_id;

      v_notice_at := now();
      INSERT INTO public.fee_notices(ledger_id, notice_at, due_at)
      VALUES (
        v_ledger_id,
        v_notice_at,
        ((v_notice_at AT TIME ZONE 'Africa/Johannesburg') + interval '7 days') AT TIME ZONE 'Africa/Johannesburg'
      );
    END IF;
  END IF;

  INSERT INTO public.audit_events(actor_id, action, entity_id, details)
  VALUES (v_user_id, 'marketplace_completion_confirmed', p_request_id,
          jsonb_build_object('payment_method', p_payment_method, 'amount_cents', p_final_amount_cents));
END
$function$;
REVOKE ALL ON FUNCTION public.marketplace_confirm_completion(uuid,bigint,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_confirm_completion(uuid,bigint,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.marketplace_cancel_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'customer') OR NOT public.has_consent() THEN
    RAISE EXCEPTION 'Customer account and privacy consent required';
  END IF;
  UPDATE public.service_requests
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_request_id AND customer_id = auth.uid() AND status IN ('submitted','accepted','quoted') AND NOT is_demo;
  IF NOT FOUND THEN RAISE EXCEPTION 'This request can no longer be cancelled here'; END IF;
  INSERT INTO public.request_events(request_id, actor_id, status, note)
  VALUES (p_request_id, auth.uid(), 'cancelled', 'Customer cancelled before work started.');
END
$function$;
REVOKE ALL ON FUNCTION public.marketplace_cancel_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_cancel_request(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.marketplace_open_dispute(p_request_id uuid, p_kind text, p_description text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_customer_id uuid;
  v_provider_id uuid;
  v_status text;
  v_case_id uuid;
BEGIN
  IF v_user_id IS NULL OR NOT public.has_consent() THEN RAISE EXCEPTION 'Sign in and accept privacy notice'; END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('workmanship','safety','payment','completion','commission','cancellation','fraud','privacy')
    OR char_length(trim(coalesce(p_description,''))) NOT BETWEEN 20 AND 3000 THEN
    RAISE EXCEPTION 'Add a support reason and a description from 20 to 3000 characters';
  END IF;
  SELECT request.customer_id, request.status,
    coalesce(quote.provider_id, (
      SELECT response.provider_id FROM public.request_responses response
      WHERE response.request_id = request.id AND response.decision = 'accepted'
      LIMIT 1
    ))
  INTO v_customer_id, v_status, v_provider_id
  FROM public.service_requests request
  LEFT JOIN public.approved_quotes approved ON approved.request_id = request.id
  LEFT JOIN public.quotes quote ON quote.id = approved.quote_id
  WHERE request.id = p_request_id AND NOT request.is_demo
  FOR UPDATE OF request;
  IF NOT FOUND OR (v_user_id IS DISTINCT FROM v_customer_id AND v_user_id IS DISTINCT FROM v_provider_id) THEN
    RAISE EXCEPTION 'Only job participants can open support';
  END IF;
  IF v_status NOT IN ('accepted','quoted','approved','in_progress','awaiting_completion','disputed') THEN
    RAISE EXCEPTION 'This request is not in a supportable job state';
  END IF;

  IF EXISTS (SELECT 1 FROM public.support_cases WHERE request_id = p_request_id AND status = 'open') THEN
    RAISE EXCEPTION 'An open support case already exists for this job';
  END IF;
  INSERT INTO public.support_cases(request_id, opened_by, kind, description)
  VALUES (p_request_id, v_user_id, p_kind, trim(p_description))
  RETURNING id INTO v_case_id;
  IF v_status <> 'disputed' THEN
    UPDATE public.service_requests SET disputed_from_status = status, status = 'disputed', updated_at = now() WHERE id = p_request_id;
    INSERT INTO public.request_events(request_id, actor_id, status, note)
    VALUES (p_request_id, v_user_id, 'disputed', 'A participant opened a support case.');
  END IF;
  INSERT INTO public.audit_events(actor_id, action, entity_id, details)
  VALUES (v_user_id, 'marketplace_dispute_opened', p_request_id, jsonb_build_object('case_id', v_case_id, 'kind', p_kind));
  RETURN v_case_id;
END
$function$;
REVOKE ALL ON FUNCTION public.marketplace_open_dispute(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_open_dispute(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.marketplace_resolve_dispute(p_case_id uuid, p_outcome text, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_request_id uuid;
  v_status text;
  v_previous_status text;
  v_next_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Authorised admin access required'; END IF;
  IF p_outcome IS NULL OR p_outcome NOT IN ('resume_work','awaiting_confirmation','cancel')
    OR char_length(trim(coalesce(p_note,''))) NOT BETWEEN 3 AND 1000 THEN
    RAISE EXCEPTION 'Choose a resolution and add a note';
  END IF;
  SELECT request_id INTO v_request_id FROM public.support_cases WHERE id = p_case_id AND status = 'open' FOR UPDATE;
  IF NOT FOUND OR v_request_id IS NULL THEN RAISE EXCEPTION 'Open job support case not found'; END IF;
  SELECT status, disputed_from_status INTO v_status, v_previous_status
  FROM public.service_requests WHERE id = v_request_id FOR UPDATE;
  IF v_status <> 'disputed' OR v_previous_status IS NULL THEN RAISE EXCEPTION 'The linked request is not disputed'; END IF;

  IF p_outcome = 'cancel' THEN
    v_next_status := 'cancelled';
  ELSIF p_outcome = 'awaiting_confirmation' THEN
    IF v_previous_status <> 'awaiting_completion' THEN
      RAISE EXCEPTION 'Only a job awaiting completion can return to confirmation';
    END IF;
    v_next_status := 'awaiting_completion';
  ELSE
    v_next_status := v_previous_status;
  END IF;
  UPDATE public.support_cases
  SET status = 'resolved', resolution_note = trim(p_note), resolved_at = now(), resolved_by = auth.uid()
  WHERE id = p_case_id;
  UPDATE public.service_requests SET status = v_next_status, disputed_from_status = NULL, updated_at = now() WHERE id = v_request_id;
  INSERT INTO public.request_events(request_id, actor_id, status, note)
  VALUES (v_request_id, auth.uid(), v_next_status, 'An administrator recorded a support resolution.');
  INSERT INTO public.audit_events(actor_id, action, entity_id, details)
  VALUES (auth.uid(), 'marketplace_dispute_resolved', v_request_id,
          jsonb_build_object('case_id', p_case_id, 'outcome', p_outcome));
END
$function$;
REVOKE ALL ON FUNCTION public.marketplace_resolve_dispute(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_resolve_dispute(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.marketplace_dispute_fee_notice(p_notice_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'provider') OR NOT public.has_consent() THEN
    RAISE EXCEPTION 'Provider account and privacy consent required';
  END IF;
  IF char_length(trim(coalesce(p_note,''))) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'Add a short dispute reason'; END IF;
  UPDATE public.fee_notices notice
  SET disputed = true, disputed_at = now(), dispute_note = trim(p_note)
  FROM public.commission_ledger ledger
  WHERE notice.id = p_notice_id AND notice.ledger_id = ledger.id
    AND ledger.provider_id = auth.uid() AND notice.disputed = false AND notice.final_notice_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'This fee notice cannot be disputed'; END IF;
END
$function$;
REVOKE ALL ON FUNCTION public.marketplace_dispute_fee_notice(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_dispute_fee_notice(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.marketplace_issue_final_fee_notice(p_notice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Authorised admin access required'; END IF;
  UPDATE public.fee_notices
  SET final_notice_at = now()
  WHERE id = p_notice_id AND disputed = false AND final_notice_at IS NULL AND due_at <= now();
  IF NOT FOUND THEN RAISE EXCEPTION 'Notice is disputed, not due, or already given'; END IF;
END
$function$;
REVOKE ALL ON FUNCTION public.marketplace_issue_final_fee_notice(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_issue_final_fee_notice(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_request_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF NEW.customer_id <> OLD.customer_id OR NEW.is_demo <> OLD.is_demo THEN
    RAISE EXCEPTION 'Ownership and demonstration mode cannot change';
  END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.is_demo AND NEW.status <> 'cancelled' THEN RAISE EXCEPTION 'Demo requests cannot become real jobs'; END IF;
  IF NOT (
    (OLD.status = 'submitted' AND NEW.status IN ('accepted','cancelled'))
    OR (OLD.status = 'accepted' AND NEW.status IN ('quoted','cancelled','disputed'))
    OR (OLD.status = 'quoted' AND NEW.status IN ('approved','cancelled','disputed'))
    OR (OLD.status = 'approved' AND NEW.status IN ('in_progress','disputed'))
    OR (OLD.status = 'in_progress' AND NEW.status IN ('awaiting_completion','disputed'))
    OR (OLD.status = 'awaiting_completion' AND NEW.status IN ('completed','disputed'))
    OR (
      OLD.status = 'disputed'
      AND (NEW.status = OLD.disputed_from_status OR NEW.status = 'cancelled')
      AND public.has_role(auth.uid(), 'admin')
    )
  ) THEN RAISE EXCEPTION 'Invalid job transition'; END IF;

  IF NEW.status IN ('approved','in_progress','awaiting_completion','completed')
    AND NOT EXISTS (SELECT 1 FROM public.approved_quotes WHERE request_id = NEW.id) THEN
    RAISE EXCEPTION 'Approved quote required';
  END IF;
  IF NEW.status = 'completed'
    AND (
      NOT EXISTS (SELECT 1 FROM public.completion_confirmations WHERE request_id = NEW.id AND user_id = NEW.customer_id)
      OR NOT EXISTS (
        SELECT 1 FROM public.completion_confirmations confirmation
        JOIN public.approved_quotes approved ON approved.request_id = confirmation.request_id
        JOIN public.quotes quote ON quote.id = approved.quote_id
        WHERE confirmation.request_id = NEW.id AND confirmation.user_id = quote.provider_id
      )
    ) THEN RAISE EXCEPTION 'Both parties must confirm completion'; END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  RAISE EXCEPTION 'Immutable record';
END
$function$;
DROP TRIGGER IF EXISTS quotes_immutable ON public.quotes;
CREATE TRIGGER quotes_immutable BEFORE UPDATE OR DELETE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.reject_mutation();
DROP TRIGGER IF EXISTS responses_immutable ON public.request_responses;
CREATE TRIGGER responses_immutable BEFORE UPDATE OR DELETE ON public.request_responses
FOR EACH ROW EXECUTE FUNCTION public.reject_mutation();


CREATE OR REPLACE FUNCTION public.marketplace_admin_list_cases()
RETURNS TABLE (
  case_id uuid,
  request_id uuid,
  opened_by uuid,
  kind text,
  description text,
  status text,
  created_at timestamptz,
  request_status text,
  request_title text,
  request_category text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Authorised admin access required';
  END IF;
  RETURN QUERY
  SELECT support.id, support.request_id, support.opened_by, support.kind, support.description,
         support.status, support.created_at, request.status, request.title, request.category
  FROM public.support_cases support
  JOIN public.service_requests request ON request.id = support.request_id
  WHERE support.status = 'open'
    AND request.is_demo = false
  ORDER BY support.created_at ASC;
END
$function$;
REVOKE ALL ON FUNCTION public.marketplace_admin_list_cases() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marketplace_admin_list_cases() TO authenticated;

COMMIT;
