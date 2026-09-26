-- Private Softsmoke post-visit platform feedback.
--
-- Rates the MyDoctors360 booking/video platform only. Not clinical quality,
-- symptoms, records, treatment outcomes, or a CQC-style care rating.
--
-- Does not reuse public.reviews: visible reviews update doctors.avg_rating
-- and can appear on the public doctor profile.
-- Does not reuse public.satisfaction_surveys: that path emails an NPS link.
-- Soft CTA email stays on HOLD — this migration sends nothing.
--
-- Free text is a separate table so the doctor-private score policy cannot
-- read it. checked_at / checked_by are the later human-check hook.
-- No public profile aggregate. No trigger on doctors.avg_rating.

CREATE TABLE public.post_visit_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  overall_rating SMALLINT NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  booking_experience_rating SMALLINT NOT NULL CHECK (booking_experience_rating BETWEEN 1 AND 5),
  waiting_room_rating SMALLINT NOT NULL CHECK (waiting_room_rating BETWEEN 1 AND 5),
  video_quality_rating SMALLINT NOT NULL CHECK (video_quality_rating BETWEEN 1 AND 5),
  book_again_rating SMALLINT NOT NULL CHECK (book_again_rating BETWEEN 1 AND 5),
  has_private_note BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.post_visit_feedback IS
  'Private Softsmoke platform-experience scores after a completed video visit. Never aggregate onto the public doctor profile or doctors.avg_rating.';

COMMENT ON COLUMN public.post_visit_feedback.overall_rating IS
  '1–5 stars for the overall MyDoctors360 platform experience. Not a clinical rating.';
COMMENT ON COLUMN public.post_visit_feedback.booking_experience_rating IS
  '1–5 stars for the booking experience on MyDoctors360.';
COMMENT ON COLUMN public.post_visit_feedback.waiting_room_rating IS
  '1–5 stars for the video waiting room.';
COMMENT ON COLUMN public.post_visit_feedback.video_quality_rating IS
  '1–5 stars for video quality.';
COMMENT ON COLUMN public.post_visit_feedback.book_again_rating IS
  '1–5 stars: would you book this doctor again on MyDoctors360? Platform rebooking, not clinical quality.';
COMMENT ON COLUMN public.post_visit_feedback.has_private_note IS
  'True when a note was stored in post_visit_feedback_notes. The note itself is not on this table.';

CREATE INDEX idx_post_visit_feedback_doctor
  ON public.post_visit_feedback (doctor_id, created_at DESC);
CREATE INDEX idx_post_visit_feedback_patient
  ON public.post_visit_feedback (patient_id, created_at DESC);

CREATE TABLE public.post_visit_feedback_notes (
  feedback_id UUID PRIMARY KEY REFERENCES public.post_visit_feedback(id) ON DELETE CASCADE,
  free_text TEXT NOT NULL CHECK (char_length(free_text) BETWEEN 1 AND 2000),
  checked_at TIMESTAMPTZ,
  checked_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.post_visit_feedback_notes IS
  'Optional private note for a later human check (checked_at, checked_by). Do not render on the public doctor profile, in review aggregates, or in email.';

-- Completed Softsmoke video booking. Identity matches the app allowlist
-- (id + slug + email). SECURITY DEFINER so profile email is readable.
CREATE OR REPLACE FUNCTION public.booking_is_softsmoke_completed_video(p_booking_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    INNER JOIN public.doctors d ON d.id = b.doctor_id
    INNER JOIN public.profiles p ON p.id = d.profile_id
    WHERE b.id = p_booking_id
      AND b.status = 'completed'
      AND b.consultation_type = 'video'
      AND d.id = '8a9b6ac9-f6f1-4b6a-b108-837a704444dc'
      AND d.slug = 'dr-vera-softsmoke-i6jv'
      AND lower(btrim(p.email)) = 'dbd.demo.email@gmail.com'
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_post_visit_feedback_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_patient UUID;
  v_doctor UUID;
BEGIN
  IF NOT public.booking_is_softsmoke_completed_video(NEW.booking_id) THEN
    RAISE EXCEPTION 'Platform feedback is only for a completed Softsmoke video visit.';
  END IF;

  SELECT b.patient_id, b.doctor_id
    INTO v_patient, v_doctor
  FROM public.bookings b
  WHERE b.id = NEW.booking_id;

  IF NEW.patient_id IS DISTINCT FROM v_patient
     OR NEW.doctor_id IS DISTINCT FROM v_doctor THEN
    RAISE EXCEPTION 'Platform feedback does not match this booking.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_post_visit_feedback_row
BEFORE INSERT OR UPDATE ON public.post_visit_feedback
FOR EACH ROW EXECUTE FUNCTION public.enforce_post_visit_feedback_row();

-- Keep the tester profile off the public review pipeline.
CREATE OR REPLACE FUNCTION public.reject_public_review_for_softsmoke()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.doctor_id = '8a9b6ac9-f6f1-4b6a-b108-837a704444dc' THEN
    RAISE EXCEPTION 'Softsmoke visits use private platform feedback and are not published on the doctor profile.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reject_public_review_for_softsmoke
BEFORE INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.reject_public_review_for_softsmoke();

CREATE OR REPLACE FUNCTION public.submit_post_visit_platform_feedback(
  p_booking_id UUID,
  p_overall SMALLINT,
  p_booking_experience SMALLINT,
  p_waiting_room SMALLINT,
  p_video_quality SMALLINT,
  p_book_again SMALLINT,
  p_free_text TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
  v_doctor UUID;
  v_note TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;

  IF p_overall NOT BETWEEN 1 AND 5
     OR p_booking_experience NOT BETWEEN 1 AND 5
     OR p_waiting_room NOT BETWEEN 1 AND 5
     OR p_video_quality NOT BETWEEN 1 AND 5
     OR p_book_again NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Choose 1 to 5 stars for each platform question.';
  END IF;

  v_note := NULLIF(btrim(COALESCE(p_free_text, '')), '');
  IF v_note IS NOT NULL AND char_length(v_note) > 2000 THEN
    RAISE EXCEPTION 'Feedback note must be 2000 characters or fewer.';
  END IF;

  SELECT b.doctor_id
    INTO v_doctor
  FROM public.bookings b
  WHERE b.id = p_booking_id
    AND b.patient_id = auth.uid();

  IF v_doctor IS NULL THEN
    RAISE EXCEPTION 'Booking not found.';
  END IF;

  INSERT INTO public.post_visit_feedback (
    booking_id,
    patient_id,
    doctor_id,
    overall_rating,
    booking_experience_rating,
    waiting_room_rating,
    video_quality_rating,
    book_again_rating,
    has_private_note
  ) VALUES (
    p_booking_id,
    auth.uid(),
    v_doctor,
    p_overall,
    p_booking_experience,
    p_waiting_room,
    p_video_quality,
    p_book_again,
    v_note IS NOT NULL
  )
  RETURNING id INTO v_id;

  IF v_note IS NOT NULL THEN
    INSERT INTO public.post_visit_feedback_notes (feedback_id, free_text)
    VALUES (v_id, v_note);
  END IF;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.booking_is_softsmoke_completed_video(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_post_visit_feedback_row() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_public_review_for_softsmoke() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_post_visit_platform_feedback(UUID, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_post_visit_platform_feedback(UUID, SMALLINT, SMALLINT, SMALLINT, SMALLINT, SMALLINT, TEXT) TO authenticated;

ALTER TABLE public.post_visit_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_visit_feedback_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY post_visit_feedback_patient_select
  ON public.post_visit_feedback
  FOR SELECT
  USING (patient_id = auth.uid());

CREATE POLICY post_visit_feedback_patient_insert
  ON public.post_visit_feedback
  FOR INSERT
  WITH CHECK (patient_id = auth.uid());

CREATE POLICY post_visit_feedback_doctor_select
  ON public.post_visit_feedback
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.doctors d
      WHERE d.id = post_visit_feedback.doctor_id
        AND d.profile_id = auth.uid()
    )
  );

CREATE POLICY post_visit_feedback_admin_all
  ON public.post_visit_feedback
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Notes: patient who wrote them, and admin for the later human check.
-- No doctor policy. No public policy.
CREATE POLICY post_visit_feedback_notes_patient_select
  ON public.post_visit_feedback_notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.post_visit_feedback f
      WHERE f.id = post_visit_feedback_notes.feedback_id
        AND f.patient_id = auth.uid()
    )
  );

CREATE POLICY post_visit_feedback_notes_patient_insert
  ON public.post_visit_feedback_notes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.post_visit_feedback f
      WHERE f.id = post_visit_feedback_notes.feedback_id
        AND f.patient_id = auth.uid()
    )
  );

CREATE POLICY post_visit_feedback_notes_admin_all
  ON public.post_visit_feedback_notes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

NOTIFY pgrst, 'reload schema';
