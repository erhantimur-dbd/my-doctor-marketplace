CREATE TABLE public.doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT,
  bio TEXT,
  years_of_experience INT,
  education JSONB DEFAULT '[]',
  certifications JSONB DEFAULT '[]',
  languages TEXT[] DEFAULT '{}',
  consultation_types TEXT[] DEFAULT '{in_person}',
  location_id UUID REFERENCES public.locations(id),
  address TEXT,
  clinic_name TEXT,
  base_currency TEXT NOT NULL DEFAULT 'EUR',
  consultation_fee_cents INT NOT NULL DEFAULT 0,
  video_consultation_fee_cents INT,
  stripe_account_id TEXT,
  stripe_onboarding_complete BOOLEAN DEFAULT FALSE,
  stripe_payouts_enabled BOOLEAN DEFAULT FALSE,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'under_review', 'verified', 'rejected', 'suspended')),
  verified_at TIMESTAMPTZ,
  is_featured BOOLEAN DEFAULT FALSE,
  featured_until TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  cancellation_policy TEXT DEFAULT 'moderate'
    CHECK (cancellation_policy IN ('flexible', 'moderate', 'strict')),
  cancellation_hours INT DEFAULT 24,
  avg_rating DECIMAL(3, 2) DEFAULT 0,
  total_reviews INT DEFAULT 0,
  total_bookings INT DEFAULT 0,
  meta_title TEXT,
  meta_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.doctor_specialties (
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  specialty_id UUID NOT NULL REFERENCES public.specialties(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (doctor_id, specialty_id)
);

CREATE TABLE public.doctor_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  alt_text TEXT,
  display_order INT DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.doctor_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'medical_license', 'diploma', 'id_document', 'insurance', 'other'
  )),
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES public.profiles(id),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_doctors_location ON public.doctors(location_id);
CREATE INDEX idx_doctors_verification ON public.doctors(verification_status);
CREATE INDEX idx_doctors_active ON public.doctors(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_doctors_featured ON public.doctors(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_doctors_rating ON public.doctors(avg_rating DESC);
CREATE INDEX idx_doctors_slug ON public.doctors(slug);
CREATE INDEX idx_doctors_profile ON public.doctors(profile_id);
CREATE INDEX idx_doctor_specialties_specialty ON public.doctor_specialties(specialty_id);
CREATE INDEX idx_doctor_specialties_doctor ON public.doctor_specialties(doctor_id);

CREATE TRIGGER trg_doctors_updated_at
BEFORE UPDATE ON public.doctors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
