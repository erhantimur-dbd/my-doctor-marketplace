CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.bookings(id),
  patient_id UUID NOT NULL REFERENCES public.profiles(id),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id),
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  comment TEXT,
  doctor_response TEXT,
  doctor_responded_at TIMESTAMPTZ,
  is_visible BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.update_doctor_rating()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_doctor_id UUID;
BEGIN
  v_doctor_id := COALESCE(NEW.doctor_id, OLD.doctor_id);
  UPDATE public.doctors SET
    avg_rating = COALESCE((
      SELECT AVG(rating)::DECIMAL(3,2)
      FROM public.reviews
      WHERE doctor_id = v_doctor_id AND is_visible = TRUE
    ), 0),
    total_reviews = (
      SELECT COUNT(*)
      FROM public.reviews
      WHERE doctor_id = v_doctor_id AND is_visible = TRUE
    ),
    updated_at = NOW()
  WHERE id = v_doctor_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_update_doctor_rating
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.update_doctor_rating();

CREATE TRIGGER trg_reviews_updated_at
BEFORE UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_reviews_doctor ON public.reviews(doctor_id);
CREATE INDEX idx_reviews_patient ON public.reviews(patient_id);
