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
