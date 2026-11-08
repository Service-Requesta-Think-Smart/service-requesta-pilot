BEGIN;

ALTER TABLE public.provider_profiles
  ADD COLUMN IF NOT EXISTS business_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS contact_email text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS qualification_summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS application_status text NOT NULL DEFAULT 'pending_review',
  ADD COLUMN IF NOT EXISTS application_privacy_version text,
  ADD COLUMN IF NOT EXISTS application_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_note text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'provider_profiles_business_name_check') THEN
    ALTER TABLE public.provider_profiles ADD CONSTRAINT provider_profiles_business_name_check
      CHECK (business_name = '' OR char_length(trim(business_name)) BETWEEN 2 AND 120);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'provider_profiles_contact_email_check') THEN
    ALTER TABLE public.provider_profiles ADD CONSTRAINT provider_profiles_contact_email_check
      CHECK (contact_email = '' OR contact_email ~ '^[^@ ]+@[^@ ]+\.[^@ ]+$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'provider_profiles_availability_check') THEN
    ALTER TABLE public.provider_profiles ADD CONSTRAINT provider_profiles_availability_check
      CHECK (availability = '' OR char_length(trim(availability)) BETWEEN 2 AND 500);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'provider_profiles_qualification_summary_check') THEN
    ALTER TABLE public.provider_profiles ADD CONSTRAINT provider_profiles_qualification_summary_check
      CHECK (qualification_summary = '' OR char_length(trim(qualification_summary)) BETWEEN 10 AND 1200);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'provider_profiles_application_status_check') THEN
    ALTER TABLE public.provider_profiles ADD CONSTRAINT provider_profiles_application_status_check
      CHECK (application_status IN ('pending_review', 'approved', 'rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'provider_profiles_application_privacy_check') THEN
    ALTER TABLE public.provider_profiles ADD CONSTRAINT provider_profiles_application_privacy_check
      CHECK (application_privacy_version IS NULL OR application_privacy_version = 'provider-application-v1');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'provider_profiles_review_note_check') THEN
    ALTER TABLE public.provider_profiles ADD CONSTRAINT provider_profiles_review_note_check
      CHECK (review_note IS NULL OR char_length(trim(review_note)) <= 1000);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS provider_profiles_review_queue
  ON public.provider_profiles (submitted_at)
  WHERE application_status = 'pending_review';

DROP POLICY IF EXISTS provider_admin_read ON public.provider_profiles;
CREATE POLICY provider_admin_read ON public.provider_profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS profiles_provider_admin_read ON public.profiles;
CREATE POLICY profiles_provider_admin_read ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM public.provider_profiles AS provider
      WHERE provider.user_id = profiles.id
    )
  );

CREATE OR REPLACE FUNCTION public.select_account_type(p_account_type text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF p_account_type IS DISTINCT FROM 'provider' THEN RAISE EXCEPTION 'Only the provider path can be selected here'; END IF;
  IF public.has_role(v_user_id, 'admin') THEN RAISE EXCEPTION 'Account role cannot be changed'; END IF;
  IF public.has_role(v_user_id, 'provider') THEN RETURN; END IF;
  IF NOT public.has_role(v_user_id, 'customer') THEN RAISE EXCEPTION 'Customer account required'; END IF;
  IF EXISTS (SELECT 1 FROM public.consents WHERE user_id = v_user_id)
    OR EXISTS (SELECT 1 FROM public.service_requests WHERE customer_id = v_user_id)
    OR EXISTS (SELECT 1 FROM public.provider_profiles WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'Account type is locked after profile setup or request activity';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = v_user_id AND role = 'customer';
  INSERT INTO public.user_roles(user_id, role) VALUES (v_user_id, 'provider');
  INSERT INTO public.audit_events(actor_id, action, entity_id, details)
  VALUES (v_user_id, 'provider_account_path_selected', v_user_id, jsonb_build_object('account_type', 'provider'));
END
$function$;
REVOKE ALL ON FUNCTION public.select_account_type(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.select_account_type(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_account_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);

  IF NEW.raw_user_meta_data ->> 'account_type' = 'provider' THEN
    v_role := 'provider';
  ELSE
    v_role := 'customer';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.submit_provider_application(
  p_business_name text,
  p_category text,
  p_area text,
  p_availability text,
  p_qualification_summary text,
  p_accept_privacy boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_email_confirmed_at timestamptz;
  v_saved_user_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;
  IF NOT public.has_role(v_user_id, 'provider') THEN
    RAISE EXCEPTION 'Provider account required';
  END IF;
  IF NOT public.has_consent() THEN
    RAISE EXCEPTION 'Pilot privacy consent required';
  END IF;
  IF p_accept_privacy IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Provider application privacy consent required';
  END IF;
  IF p_business_name IS NULL OR char_length(trim(p_business_name)) NOT BETWEEN 2 AND 120 THEN
    RAISE EXCEPTION 'Business name must be between 2 and 120 characters';
  END IF;
  IF p_category IS NULL OR p_category NOT IN ('plumbing', 'electrical', 'motor_mechanics') THEN
    RAISE EXCEPTION 'Choose one of the available pilot service categories';
  END IF;
  IF p_area IS NULL OR char_length(trim(p_area)) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'Service area must be between 2 and 100 characters';
  END IF;
  IF p_availability IS NULL OR char_length(trim(p_availability)) NOT BETWEEN 2 AND 500 THEN
    RAISE EXCEPTION 'Availability must be between 2 and 500 characters';
  END IF;
  IF char_length(trim(coalesce(p_qualification_summary, ''))) NOT BETWEEN 10 AND 1200 THEN
    RAISE EXCEPTION 'Describe relevant training, qualifications, or experience in 10 to 1200 characters';
  END IF;

  SELECT lower(email), email_confirmed_at
    INTO v_email, v_email_confirmed_at
  FROM auth.users
  WHERE id = v_user_id;
  IF v_email IS NULL OR char_length(v_email) > 254 OR v_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'A verified email address is required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 1));

  INSERT INTO public.provider_profiles (
    user_id,
    business_name,
    contact_email,
    category,
    area,
    availability,
    qualification_summary,
    application_status,
    application_privacy_version,
    application_accepted_at,
    submitted_at,
    identity_status,
    trade_status,
    reviewed_at,
    reviewed_by,
    review_note
  )
  VALUES (
    v_user_id,
    trim(p_business_name),
    v_email,
    p_category,
    trim(p_area),
    trim(p_availability),
    trim(coalesce(p_qualification_summary, '')),
    'pending_review',
    'provider-application-v1',
    now(),
    now(),
    'not_checked',
    'not_checked',
    NULL,
    NULL,
    NULL
  )
  ON CONFLICT (user_id) DO UPDATE SET
    business_name = EXCLUDED.business_name,
    contact_email = EXCLUDED.contact_email,
    category = EXCLUDED.category,
    area = EXCLUDED.area,
    availability = EXCLUDED.availability,
    qualification_summary = EXCLUDED.qualification_summary,
    application_status = 'pending_review',
    application_privacy_version = EXCLUDED.application_privacy_version,
    application_accepted_at = now(),
    submitted_at = now(),
    identity_status = 'not_checked',
    trade_status = 'not_checked',
    reviewed_at = NULL,
    reviewed_by = NULL,
    review_note = NULL
  WHERE public.provider_profiles.application_status = 'rejected'
     OR (
       public.provider_profiles.application_status = 'pending_review'
       AND (
         public.provider_profiles.business_name = ''
         OR public.provider_profiles.availability = ''
         OR public.provider_profiles.qualification_summary = ''
       )
     )
  RETURNING user_id INTO v_saved_user_id;

  IF v_saved_user_id IS NULL THEN
    RAISE EXCEPTION 'An application is already under review or approved';
  END IF;

  INSERT INTO public.audit_events (actor_id, action, entity_id, details)
  VALUES (
    v_user_id,
    'provider_application_submitted',
    v_user_id,
    jsonb_build_object('category', p_category, 'application_status', 'pending_review')
  );
END
$function$;

REVOKE ALL ON FUNCTION public.submit_provider_application(text, text, text, text, text, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_provider_application(text, text, text, text, text, boolean)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.review_provider_application(
  p_provider_id uuid,
  p_decision text,
  p_identity_status text,
  p_trade_status text,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
BEGIN
  IF v_actor_id IS NULL OR NOT public.has_role(v_actor_id, 'admin') THEN
    RAISE EXCEPTION 'Authorised admin access required';
  END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid application decision';
  END IF;
  IF p_identity_status IS NULL OR p_identity_status NOT IN ('not_checked', 'pending', 'checked') THEN
    RAISE EXCEPTION 'Invalid identity check status';
  END IF;
  IF p_trade_status IS NULL OR p_trade_status NOT IN ('not_checked', 'pending', 'reviewed') THEN
    RAISE EXCEPTION 'Invalid trade check status';
  END IF;
  IF p_decision = 'approved'
     AND (p_identity_status <> 'checked' OR p_trade_status <> 'reviewed') THEN
    RAISE EXCEPTION 'Complete the identity and trade review before approving';
  END IF;
  IF char_length(trim(coalesce(p_note, ''))) < 3 THEN
    RAISE EXCEPTION 'Add a review note before recording this decision';
  END IF;
  IF char_length(trim(coalesce(p_note, ''))) > 1000 THEN
    RAISE EXCEPTION 'Review note must be 1000 characters or fewer';
  END IF;

  UPDATE public.provider_profiles
  SET application_status = p_decision,
      identity_status = p_identity_status,
      trade_status = p_trade_status,
      reviewed_at = now(),
      reviewed_by = v_actor_id,
      review_note = nullif(trim(coalesce(p_note, '')), '')
  WHERE user_id = p_provider_id
    AND application_status = 'pending_review';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This provider application is no longer awaiting review';
  END IF;

  INSERT INTO public.audit_events (actor_id, action, entity_id, details)
  VALUES (
    v_actor_id,
    'provider_application_reviewed',
    p_provider_id,
    jsonb_build_object(
      'decision', p_decision,
      'identity_status', p_identity_status,
      'trade_status', p_trade_status
    )
  );
END
$function$;

REVOKE ALL ON FUNCTION public.review_provider_application(uuid, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_provider_application(uuid, text, text, text, text)
  TO authenticated;

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
      SELECT 1 FROM public.feature_flags
      WHERE name = 'public_bookings' AND enabled
    )
    AND EXISTS (
      SELECT 1 FROM public.feature_flags
      WHERE name = 'legal_approval' AND enabled
    )
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
          request.status = 'submitted'
          OR EXISTS (
            SELECT 1
            FROM public.request_responses AS response
            WHERE response.request_id = request.id
              AND response.provider_id = auth.uid()
              AND response.decision = 'accepted'
          )
        )
    )
$function$;

REVOKE ALL ON FUNCTION public.provider_can_see_open(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.provider_can_see_open(uuid) TO authenticated;

COMMIT;
