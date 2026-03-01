-- 1a. Add provider_type column to doctors table
ALTER TABLE public.doctors
  ADD COLUMN provider_type TEXT NOT NULL DEFAULT 'doctor'
  CHECK (provider_type IN ('doctor', 'testing_service'));

CREATE INDEX idx_doctors_provider_type ON public.doctors(provider_type);

-- 1b. Add category column to specialties table
ALTER TABLE public.specialties
  ADD COLUMN category TEXT NOT NULL DEFAULT 'medical'
  CHECK (category IN ('medical', 'testing'));

-- 1c. Seed testing service specialties
INSERT INTO public.specialties (name_key, slug, icon, display_order, is_active, category) VALUES
  ('specialty.blood_tests', 'blood-tests', 'Droplets', 100, TRUE, 'testing'),
  ('specialty.mri_scans', 'mri-scans', 'Scan', 101, TRUE, 'testing'),
  ('specialty.ct_scans', 'ct-scans', 'Scan', 102, TRUE, 'testing'),
  ('specialty.xray', 'xray', 'Scan', 103, TRUE, 'testing'),
  ('specialty.ultrasound', 'ultrasound', 'Radio', 104, TRUE, 'testing'),
  ('specialty.urine_tests', 'urine-tests', 'FlaskConical', 105, TRUE, 'testing'),
  ('specialty.allergy_testing', 'allergy-testing', 'Flower', 106, TRUE, 'testing'),
  ('specialty.ecg_heart_tests', 'ecg-heart-tests', 'HeartPulse', 107, TRUE, 'testing'),
  ('specialty.sti_testing', 'sti-testing', 'Shield', 108, TRUE, 'testing'),
  ('specialty.health_screenings', 'health-screenings', 'ClipboardCheck', 109, TRUE, 'testing');
