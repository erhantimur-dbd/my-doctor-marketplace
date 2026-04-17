-- Skill endorsements attached to reviews.
-- Each review can endorse up to 5 skills (enforced in the app layer).
-- Counts are aggregated per (doctor_id, skill_slug) for profile display.

CREATE TABLE public.review_endorsements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  skill_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (review_id, skill_slug)
);

CREATE INDEX idx_review_endorsements_doctor_skill
  ON public.review_endorsements(doctor_id, skill_slug);

CREATE INDEX idx_review_endorsements_review
  ON public.review_endorsements(review_id);

ALTER TABLE public.review_endorsements ENABLE ROW LEVEL SECURITY;

-- Public read: endorsements are visible when the parent review is visible.
CREATE POLICY "review_endorsements_select_visible"
  ON public.review_endorsements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_endorsements.review_id
        AND r.is_visible = TRUE
    )
  );

-- Insert: only the patient who authored the underlying review.
CREATE POLICY "review_endorsements_insert_owner"
  ON public.review_endorsements
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_endorsements.review_id
        AND r.patient_id = auth.uid()
    )
  );

-- Delete: only the patient who authored the underlying review.
CREATE POLICY "review_endorsements_delete_owner"
  ON public.review_endorsements
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.reviews r
      WHERE r.id = review_endorsements.review_id
        AND r.patient_id = auth.uid()
    )
  );
