-- Account erasure when prescriptions or audit rows must be kept.
--
-- Migration A makes prescription_audit_log append-only and
-- prescription_id ON DELETE RESTRICT. auth.admin.deleteUser then fails
-- with 23503 for a patient who has an audited prescription (the cascade
-- tries to delete the prescription) and for a doctor who wrote audit rows
-- (actor_profile_id references profiles, and the doctor's prescriptions
-- cascade from doctors). Prod has no prescriptions yet. This has to be
-- applied before prescribing is turned on.
--
-- public.erase_account(uuid) is the only supported database step:
--   * no prescriptions and no audit rows -> {"mode":"hard_delete"}
--     and the app still calls auth.admin.deleteUser
--   * otherwise anonymise in this transaction and return
--     {"mode":"anonymised","erased_at":...}
--     Prescriptions and audit rows stay, still linked to the same ids.
--
-- The function bans the auth user and replaces the auth email with
-- erased+<uuid>@users.invalid (.invalid is non-routable). The app also
-- calls auth.admin.updateUserById so GoTrue applies the same ban.
--
-- Profiles have no date_of_birth column in this repo. Dependents do.
-- If a date_of_birth column exists on profiles, it is cleared too.
--
-- Kept on purpose, for a retention decision: prescription and audit
-- payloads, booking rows (finished patient_notes are cleared), review
-- text, messages, GMC / CQC / indemnity / Stripe identifiers, and
-- objects already stored in buckets. See the PR for the list.
--
-- Idempotent. SECURITY DEFINER, search_path empty, EXECUTE only for
-- service_role. Safe inside BEGIN ... ROLLBACK (no CONCURRENTLY).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS erased_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.erased_at IS
  'When this account was anonymised because prescriptions or prescription_audit_log rows had to be kept. NULL if the account has not been erased this way.';

CREATE OR REPLACE FUNCTION public.erase_account(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_email text;
  v_erased_at timestamptz;
  v_retain boolean;
BEGIN
  IF coalesce((SELECT auth.role()), ''::text) IS DISTINCT FROM 'service_role'
     AND (SELECT auth.uid()) IS NOT NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings AS b
    WHERE b.status IN ('confirmed', 'approved', 'pending_payment', 'pending_approval')
      AND (
        b.patient_id = p_user_id
        OR b.doctor_id IN (
          SELECT d.id FROM public.doctors AS d WHERE d.profile_id = p_user_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'active_bookings' USING ERRCODE = 'P0001';
  END IF;

  v_retain := EXISTS (
    SELECT 1
    FROM public.prescriptions AS p
    WHERE p.patient_id = p_user_id
       OR p.doctor_id IN (
         SELECT d.id FROM public.doctors AS d WHERE d.profile_id = p_user_id
       )
  ) OR EXISTS (
    SELECT 1
    FROM public.prescription_audit_log AS a
    WHERE a.actor_profile_id = p_user_id
  );

  IF NOT v_retain THEN
    RETURN pg_catalog.jsonb_build_object('mode', 'hard_delete');
  END IF;

  v_email := 'erased+' || p_user_id::text || '@users.invalid';

  UPDATE public.profiles
  SET
    first_name = 'Erased',
    last_name = 'Account',
    email = v_email,
    phone = NULL,
    avatar_url = NULL,
    address_line1 = NULL,
    address_line2 = NULL,
    city = NULL,
    state = NULL,
    postal_code = NULL,
    country = NULL,
    erased_at = coalesce(erased_at, pg_catalog.now())
  WHERE id = p_user_id;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'date_of_birth'
  ) THEN
    EXECUTE 'UPDATE public.profiles SET date_of_birth = NULL WHERE id = $1'
      USING p_user_id;
  END IF;

  SELECT p.erased_at INTO v_erased_at
  FROM public.profiles AS p
  WHERE p.id = p_user_id;

  UPDATE public.doctors
  SET
    is_active = FALSE,
    is_featured = FALSE,
    featured_until = NULL,
    verification_status = 'suspended',
    bio = NULL,
    address = NULL,
    city = NULL,
    postal_code = NULL,
    clinic_name = NULL,
    clinic_latitude = NULL,
    clinic_longitude = NULL,
    education = '[]'::jsonb,
    certifications = '[]'::jsonb,
    meta_title = NULL,
    meta_description = NULL,
    profile_video_path = NULL,
    profile_video_status = NULL,
    profile_video_uploaded_at = NULL,
    profile_video_reviewed_at = NULL,
    profile_video_rejection_reason = NULL,
    gender = NULL,
    slug = 'erased-' || id::text,
    referral_code = 'erased' || pg_catalog.replace(id::text, '-', ''),
    ics_feed_token = NULL
  WHERE profile_id = p_user_id;

  DELETE FROM public.doctor_photos
  WHERE doctor_id IN (
    SELECT d.id FROM public.doctors AS d WHERE d.profile_id = p_user_id
  );

  IF pg_catalog.to_regclass('public.doctor_faqs') IS NOT NULL THEN
    DELETE FROM public.doctor_faqs
    WHERE doctor_id IN (
      SELECT d.id FROM public.doctors AS d WHERE d.profile_id = p_user_id
    );
  END IF;

  IF pg_catalog.to_regclass('public.doctor_calendar_connections') IS NOT NULL THEN
    DELETE FROM public.doctor_calendar_connections
    WHERE doctor_id IN (
      SELECT d.id FROM public.doctors AS d WHERE d.profile_id = p_user_id
    );
  END IF;

  IF pg_catalog.to_regclass('public.doctor_testing_locations') IS NOT NULL THEN
    UPDATE public.doctor_testing_locations
    SET
      name = 'Erased location',
      address = '',
      city = '',
      postal_code = NULL,
      phone = NULL,
      latitude = NULL,
      longitude = NULL,
      is_active = FALSE
    WHERE doctor_id IN (
      SELECT d.id FROM public.doctors AS d WHERE d.profile_id = p_user_id
    );
  END IF;

  IF pg_catalog.to_regclass('public.dependents') IS NOT NULL THEN
    UPDATE public.dependents
    SET
      first_name = 'Erased',
      last_name = 'Account',
      date_of_birth = NULL,
      notes = NULL
    WHERE parent_id = p_user_id;
  END IF;

  IF pg_catalog.to_regclass('public.dependent_medical_profiles') IS NOT NULL
     AND pg_catalog.to_regclass('public.dependents') IS NOT NULL THEN
    UPDATE public.dependent_medical_profiles
    SET
      blood_type = NULL,
      allergies = '{}'::text[],
      chronic_conditions = '{}'::text[],
      current_medications = '{}'::text[],
      emergency_contact_name = NULL,
      emergency_contact_phone = NULL,
      notes = NULL
    WHERE dependent_id IN (
      SELECT dep.id FROM public.dependents AS dep WHERE dep.parent_id = p_user_id
    );
  END IF;

  IF pg_catalog.to_regclass('public.medical_profiles') IS NOT NULL THEN
    UPDATE public.medical_profiles
    SET
      blood_type = NULL,
      allergies = '{}'::text[],
      chronic_conditions = '{}'::text[],
      current_medications = '{}'::text[],
      emergency_contact_name = NULL,
      emergency_contact_phone = NULL,
      notes = NULL
    WHERE patient_id = p_user_id;
  END IF;

  UPDATE public.bookings
  SET patient_notes = NULL
  WHERE patient_id = p_user_id
    AND status IN ('completed', 'cancelled_patient', 'cancelled_doctor', 'no_show');

  DELETE FROM public.push_subscriptions WHERE user_id = p_user_id;
  DELETE FROM public.cookie_consents WHERE user_id = p_user_id;

  UPDATE auth.users
  SET
    email = v_email,
    phone = NULL,
    banned_until = pg_catalog.now() + interval '876000 hours',
    raw_user_meta_data = pg_catalog.jsonb_build_object(
      'role', pg_catalog.to_jsonb(raw_user_meta_data ->> 'role'),
      'erased', pg_catalog.to_jsonb(true)
    ),
    updated_at = pg_catalog.now()
  WHERE id = p_user_id;

  IF pg_catalog.to_regclass('auth.identities') IS NOT NULL THEN
    UPDATE auth.identities
    SET
      provider_id = CASE WHEN provider = 'email' THEN v_email ELSE provider_id END,
      identity_data = (coalesce(identity_data, '{}'::jsonb) - 'phone')
        || pg_catalog.jsonb_build_object('email', v_email)
    WHERE user_id = p_user_id;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'auth'
        AND table_name = 'identities'
        AND column_name = 'email'
        AND is_generated = 'NEVER'
    ) THEN
      EXECUTE $identity_email$
        UPDATE auth.identities SET email = $1 WHERE user_id = $2
      $identity_email$
      USING v_email, p_user_id;
    END IF;
  END IF;

  IF pg_catalog.to_regclass('auth.sessions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM auth.sessions WHERE user_id::text = $1'
      USING p_user_id::text;
  END IF;

  IF pg_catalog.to_regclass('auth.refresh_tokens') IS NOT NULL THEN
    EXECUTE 'DELETE FROM auth.refresh_tokens WHERE user_id::text = $1'
      USING p_user_id::text;
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'mode', 'anonymised',
    'erased_at', v_erased_at,
    'email', v_email
  );
END;
$fn$;

COMMENT ON FUNCTION public.erase_account(uuid) IS
  'Anonymise an account that has prescriptions or audit rows. Returns hard_delete when auth.admin.deleteUser is still safe.';

REVOKE ALL ON FUNCTION public.erase_account(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.erase_account(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.erase_account(uuid) TO service_role;
