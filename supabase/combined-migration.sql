-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')) DEFAULT 'patient',
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  preferred_locale TEXT DEFAULT 'en',
  preferred_currency TEXT DEFAULT 'EUR' CHECK (preferred_currency IN ('EUR', 'GBP', 'TRY', 'USD')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, first_name, last_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TABLE public.specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_key TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  city TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  timezone TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_locations_country ON public.locations(country_code);
CREATE INDEX idx_locations_slug ON public.locations(slug);
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
CREATE TABLE public.availability_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_duration_minutes INT NOT NULL DEFAULT 30,
  consultation_type TEXT NOT NULL DEFAULT 'in_person'
    CHECK (consultation_type IN ('in_person', 'video')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

CREATE TABLE public.availability_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT FALSE,
  start_time TIME,
  end_time TIME,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(doctor_id, override_date, start_time)
);

CREATE INDEX idx_availability_doctor_day ON public.availability_schedules(doctor_id, day_of_week);
CREATE INDEX idx_availability_overrides_doctor_date ON public.availability_overrides(doctor_id, override_date);
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number TEXT NOT NULL UNIQUE,
  patient_id UUID NOT NULL REFERENCES public.profiles(id),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id),
  appointment_date DATE NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  consultation_type TEXT NOT NULL CHECK (consultation_type IN ('in_person', 'video')),
  video_room_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN (
      'pending_payment', 'confirmed', 'pending_approval', 'approved',
      'rejected', 'completed', 'cancelled_patient', 'cancelled_doctor',
      'no_show', 'refunded'
    )),
  currency TEXT NOT NULL,
  consultation_fee_cents INT NOT NULL,
  platform_fee_cents INT NOT NULL,
  total_amount_cents INT NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_amount_cents INT,
  patient_notes TEXT,
  patient_phone TEXT,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancellation_fee_cents INT DEFAULT 0,
  reminder_24h_sent BOOLEAN DEFAULT FALSE,
  reminder_1h_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION public.generate_booking_number()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.booking_number := 'BK-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' ||
    UPPER(SUBSTRING(gen_random_uuid()::TEXT FROM 1 FOR 4));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_generate_booking_number
BEFORE INSERT ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.generate_booking_number();

CREATE TRIGGER trg_bookings_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_bookings_patient ON public.bookings(patient_id);
CREATE INDEX idx_bookings_doctor ON public.bookings(doctor_id);
CREATE INDEX idx_bookings_date ON public.bookings(appointment_date);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_doctor_date ON public.bookings(doctor_id, appointment_date);
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
CREATE TABLE public.doctor_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'active', 'past_due', 'cancelled', 'trialing', 'incomplete'
  )),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.platform_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id),
  doctor_id UUID NOT NULL REFERENCES public.doctors(id),
  fee_type TEXT NOT NULL CHECK (fee_type IN ('commission', 'processing')),
  amount_cents INT NOT NULL,
  currency TEXT NOT NULL,
  stripe_application_fee_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_subscriptions_updated_at
BEFORE UPDATE ON public.doctor_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TABLE public.favorites (
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (patient_id, doctor_id)
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  channel TEXT NOT NULL DEFAULT 'in_app'
    CHECK (channel IN ('in_app', 'email', 'sms', 'whatsapp')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id) WHERE read = FALSE;
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.specialties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- DOCTORS
CREATE POLICY "Anyone can read verified doctors" ON public.doctors
  FOR SELECT USING (verification_status = 'verified' AND is_active = TRUE);
CREATE POLICY "Doctors can read own profile" ON public.doctors
  FOR SELECT USING (profile_id = auth.uid());
CREATE POLICY "Doctors can update own profile" ON public.doctors
  FOR UPDATE USING (profile_id = auth.uid());
CREATE POLICY "Doctors can insert own profile" ON public.doctors
  FOR INSERT WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Admins can manage all doctors" ON public.doctors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- DOCTOR SPECIALTIES
CREATE POLICY "Anyone can read doctor specialties" ON public.doctor_specialties
  FOR SELECT USING (TRUE);
CREATE POLICY "Doctors can manage own specialties" ON public.doctor_specialties
  FOR ALL USING (
    doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid())
  );

-- DOCTOR PHOTOS
CREATE POLICY "Anyone can read doctor photos" ON public.doctor_photos
  FOR SELECT USING (TRUE);
CREATE POLICY "Doctors can manage own photos" ON public.doctor_photos
  FOR ALL USING (
    doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid())
  );

-- DOCTOR DOCUMENTS
CREATE POLICY "Doctors can manage own documents" ON public.doctor_documents
  FOR ALL USING (
    doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid())
  );
CREATE POLICY "Admins can read all documents" ON public.doctor_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- SPECIALTIES & LOCATIONS (public read)
CREATE POLICY "Anyone can read specialties" ON public.specialties FOR SELECT USING (TRUE);
CREATE POLICY "Anyone can read locations" ON public.locations FOR SELECT USING (TRUE);

-- AVAILABILITY
CREATE POLICY "Anyone can read availability" ON public.availability_schedules FOR SELECT USING (TRUE);
CREATE POLICY "Doctors can manage own availability" ON public.availability_schedules
  FOR ALL USING (doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid()));
CREATE POLICY "Anyone can read overrides" ON public.availability_overrides FOR SELECT USING (TRUE);
CREATE POLICY "Doctors can manage own overrides" ON public.availability_overrides
  FOR ALL USING (doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid()));

-- BOOKINGS
CREATE POLICY "Patients can read own bookings" ON public.bookings
  FOR SELECT USING (patient_id = auth.uid());
CREATE POLICY "Doctors can read their bookings" ON public.bookings
  FOR SELECT USING (doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid()));
CREATE POLICY "Patients can create bookings" ON public.bookings
  FOR INSERT WITH CHECK (patient_id = auth.uid());
CREATE POLICY "Admins can read all bookings" ON public.bookings
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- REVIEWS
CREATE POLICY "Anyone can read visible reviews" ON public.reviews FOR SELECT USING (is_visible = TRUE);
CREATE POLICY "Patients can create reviews" ON public.reviews FOR INSERT WITH CHECK (patient_id = auth.uid());
CREATE POLICY "Doctors can respond to reviews" ON public.reviews
  FOR UPDATE USING (doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid()));
CREATE POLICY "Admins can manage reviews" ON public.reviews
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- SUBSCRIPTIONS
CREATE POLICY "Doctors can read own subscription" ON public.doctor_subscriptions
  FOR SELECT USING (doctor_id IN (SELECT id FROM public.doctors WHERE profile_id = auth.uid()));

-- PLATFORM FEES
CREATE POLICY "Admins can read all fees" ON public.platform_fees
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- FAVORITES
CREATE POLICY "Users manage own favorites" ON public.favorites FOR ALL USING (patient_id = auth.uid());

-- NOTIFICATIONS
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());

-- AUDIT LOG
CREATE POLICY "Admins can read audit log" ON public.audit_log
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
-- Get available slots for a doctor on a given date
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_doctor_id UUID,
  p_date DATE,
  p_consultation_type TEXT DEFAULT 'in_person'
)
RETURNS TABLE (
  slot_start TIMESTAMPTZ,
  slot_end TIMESTAMPTZ,
  is_available BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_day_of_week INT;
  v_timezone TEXT;
BEGIN
  v_day_of_week := EXTRACT(DOW FROM p_date);

  SELECT COALESCE(l.timezone, 'Europe/London') INTO v_timezone
  FROM public.doctors d
  LEFT JOIN public.locations l ON d.location_id = l.id
  WHERE d.id = p_doctor_id;

  -- Check if entire day is blocked
  IF EXISTS (
    SELECT 1 FROM public.availability_overrides
    WHERE doctor_id = p_doctor_id
      AND override_date = p_date
      AND is_available = FALSE
      AND start_time IS NULL
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH schedule_slots AS (
    SELECT
      (p_date + s.start_time) AT TIME ZONE v_timezone AS slot_s,
      (p_date + s.end_time) AT TIME ZONE v_timezone AS slot_e,
      s.slot_duration_minutes
    FROM public.availability_schedules s
    WHERE s.doctor_id = p_doctor_id
      AND s.day_of_week = v_day_of_week
      AND s.consultation_type = p_consultation_type
      AND s.is_active = TRUE
  ),
  expanded_slots AS (
    SELECT
      slot_s + (n * (slot_duration_minutes || ' minutes')::INTERVAL) AS s_start,
      slot_s + ((n + 1) * (slot_duration_minutes || ' minutes')::INTERVAL) AS s_end
    FROM schedule_slots,
    generate_series(0, (EXTRACT(EPOCH FROM slot_e - slot_s) / (slot_duration_minutes * 60))::INT - 1) AS n
  ),
  booked AS (
    SELECT b.start_time, b.end_time
    FROM public.bookings b
    WHERE b.doctor_id = p_doctor_id
      AND b.appointment_date = p_date
      AND b.status IN ('confirmed', 'pending_approval', 'approved', 'pending_payment')
  )
  SELECT
    es.s_start AS slot_start,
    es.s_end AS slot_end,
    NOT EXISTS (
      SELECT 1 FROM booked bk
      WHERE bk.start_time < es.s_end AND bk.end_time > es.s_start
    ) AS is_available
  FROM expanded_slots es
  WHERE es.s_start > NOW()
  ORDER BY es.s_start;
END;
$$;
-- Seed specialties
INSERT INTO public.specialties (name_key, slug, icon, display_order) VALUES
  ('specialty.general_practice', 'general-practice', 'Stethoscope', 1),
  ('specialty.cardiology', 'cardiology', 'Heart', 2),
  ('specialty.dermatology', 'dermatology', 'Sparkles', 3),
  ('specialty.orthopedics', 'orthopedics', 'Bone', 4),
  ('specialty.neurology', 'neurology', 'Brain', 5),
  ('specialty.psychiatry', 'psychiatry', 'Brain', 6),
  ('specialty.psychology', 'psychology', 'HeartHandshake', 7),
  ('specialty.ophthalmology', 'ophthalmology', 'Eye', 8),
  ('specialty.ent', 'ent', 'Ear', 9),
  ('specialty.gynecology', 'gynecology', 'Baby', 10),
  ('specialty.urology', 'urology', 'Activity', 11),
  ('specialty.gastroenterology', 'gastroenterology', 'Apple', 12),
  ('specialty.endocrinology', 'endocrinology', 'Droplets', 13),
  ('specialty.pulmonology', 'pulmonology', 'Wind', 14),
  ('specialty.oncology', 'oncology', 'Shield', 15),
  ('specialty.pediatrics', 'pediatrics', 'Baby', 16),
  ('specialty.dentistry', 'dentistry', 'Smile', 17),
  ('specialty.aesthetic_medicine', 'aesthetic-medicine', 'Sparkles', 18),
  ('specialty.physiotherapy', 'physiotherapy', 'Activity', 19),
  ('specialty.radiology', 'radiology', 'Scan', 20),
  ('specialty.nutrition', 'nutrition', 'Apple', 21),
  ('specialty.allergy', 'allergy', 'Flower', 22),
  ('specialty.rheumatology', 'rheumatology', 'Bone', 23),
  ('specialty.nephrology', 'nephrology', 'Droplets', 24);

-- Seed locations
INSERT INTO public.locations (country_code, city, slug, latitude, longitude, timezone) VALUES
  ('DE', 'Berlin', 'berlin-germany', 52.52000660, 13.40495400, 'Europe/Berlin'),
  ('DE', 'Munich', 'munich-germany', 48.13512530, 11.58198050, 'Europe/Berlin'),
  ('DE', 'Hamburg', 'hamburg-germany', 53.55108460, 9.99368200, 'Europe/Berlin'),
  ('DE', 'Frankfurt', 'frankfurt-germany', 50.11092200, 8.68212700, 'Europe/Berlin'),
  ('TR', 'Istanbul', 'istanbul-turkey', 41.00823200, 28.97835900, 'Europe/Istanbul'),
  ('TR', 'Ankara', 'ankara-turkey', 39.92077000, 32.85410700, 'Europe/Istanbul'),
  ('TR', 'Izmir', 'izmir-turkey', 38.42369200, 27.14285700, 'Europe/Istanbul'),
  ('TR', 'Antalya', 'antalya-turkey', 36.89689000, 30.71327800, 'Europe/Istanbul'),
  ('GB', 'London', 'london-uk', 51.50735090, -0.12775830, 'Europe/London'),
  ('GB', 'Manchester', 'manchester-uk', 53.48075930, -2.24263050, 'Europe/London'),
  ('GB', 'Birmingham', 'birmingham-uk', 52.48624800, -1.89031000, 'Europe/London'),
  ('GB', 'Edinburgh', 'edinburgh-uk', 55.95325200, -3.18826700, 'Europe/London'),
  ('FR', 'Paris', 'paris-france', 48.85661400, 2.35222190, 'Europe/Paris'),
  ('FR', 'Lyon', 'lyon-france', 45.76404200, 4.83565700, 'Europe/Paris'),
  ('FR', 'Marseille', 'marseille-france', 43.29648200, 5.36978000, 'Europe/Paris'),
  ('NL', 'Amsterdam', 'amsterdam-netherlands', 52.37021570, 4.89516780, 'Europe/Amsterdam'),
  ('AT', 'Vienna', 'vienna-austria', 48.20817400, 16.37381900, 'Europe/Vienna'),
  ('CH', 'Zurich', 'zurich-switzerland', 47.37688600, 8.54169400, 'Europe/Zurich'),
  ('ES', 'Barcelona', 'barcelona-spain', 41.38506390, 2.17340350, 'Europe/Madrid'),
  ('ES', 'Madrid', 'madrid-spain', 40.41676900, -3.70379200, 'Europe/Madrid'),
  ('IT', 'Rome', 'rome-italy', 41.90278300, 12.49636500, 'Europe/Rome'),
  ('IT', 'Milan', 'milan-italy', 45.46427040, 9.18951430, 'Europe/Rome'),
  ('BE', 'Brussels', 'brussels-belgium', 50.85034000, 4.35171000, 'Europe/Brussels');

-- Seed platform settings
INSERT INTO public.platform_settings (key, value) VALUES
  ('commission_rate', '0.15'),
  ('platform_fee_type', '"percentage"'),
  ('booking_expiry_minutes', '15'),
  ('default_slot_duration', '30'),
  ('max_booking_days_ahead', '90');
