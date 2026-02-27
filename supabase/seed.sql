-- ============================================================================
-- MyDoctor Marketplace - Seed Data
-- Run this in Supabase SQL Editor after all migrations are applied.
-- All users have password: Password123!
-- Safe to re-run: cleans up existing seed data first.
-- ============================================================================

-- ============================================================================
-- 0. CLEANUP EXISTING SEED DATA (reverse FK order)
-- ============================================================================
DELETE FROM public.booking_reminders_sent WHERE booking_id IN (
  SELECT id FROM public.bookings WHERE id::TEXT LIKE 'f0000000-0000-0000-0000-%'
);
DELETE FROM public.doctor_reminder_preferences WHERE doctor_id IN (
  SELECT id FROM public.doctors WHERE id::TEXT LIKE 'e0000000-0000-0000-0000-%'
);
DELETE FROM public.favorites WHERE patient_id::TEXT LIKE 'c0000000-0000-0000-0000-%';
DELETE FROM public.reviews WHERE booking_id IN (
  SELECT id FROM public.bookings WHERE id::TEXT LIKE 'f0000000-0000-0000-0000-%'
);
DELETE FROM public.bookings WHERE id::TEXT LIKE 'f0000000-0000-0000-0000-%';
DELETE FROM public.availability_schedules WHERE doctor_id IN (
  SELECT id FROM public.doctors WHERE id::TEXT LIKE 'e0000000-0000-0000-0000-%'
);
DELETE FROM public.doctor_specialties WHERE doctor_id IN (
  SELECT id FROM public.doctors WHERE id::TEXT LIKE 'e0000000-0000-0000-0000-%'
);
DELETE FROM public.doctor_photos WHERE doctor_id IN (
  SELECT id FROM public.doctors WHERE id::TEXT LIKE 'e0000000-0000-0000-0000-%'
);
DELETE FROM public.doctor_documents WHERE doctor_id IN (
  SELECT id FROM public.doctors WHERE id::TEXT LIKE 'e0000000-0000-0000-0000-%'
);
DELETE FROM public.doctors WHERE id::TEXT LIKE 'e0000000-0000-0000-0000-%';
DELETE FROM public.profiles WHERE id::TEXT LIKE 'c0000000-0000-0000-0000-%' OR id::TEXT LIKE 'd0000000-0000-0000-0000-%';
DELETE FROM auth.identities WHERE user_id::TEXT LIKE 'c0000000-0000-0000-0000-%' OR user_id::TEXT LIKE 'd0000000-0000-0000-0000-%';
DELETE FROM auth.users WHERE id::TEXT LIKE 'c0000000-0000-0000-0000-%' OR id::TEXT LIKE 'd0000000-0000-0000-0000-%';

-- ============================================================================
-- 1. SPECIALTIES (24)
-- ============================================================================
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
  ('specialty.nephrology', 'nephrology', 'Droplets', 24)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 2. LOCATIONS
-- ============================================================================
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
  ('BE', 'Brussels', 'brussels-belgium', 50.85034000, 4.35171000, 'Europe/Brussels')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 3. PLATFORM SETTINGS
-- ============================================================================
INSERT INTO public.platform_settings (key, value) VALUES
  ('commission_rate', '0.15'),
  ('platform_fee_type', '"percentage"'),
  ('booking_expiry_minutes', '15'),
  ('default_slot_duration', '30'),
  ('max_booking_days_ahead', '90')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- 4. AUTH USERS (all with password: Password123!)
-- ============================================================================
-- Disable booking number trigger temporarily
ALTER TABLE public.bookings DISABLE TRIGGER trg_generate_booking_number;

-- Patients
-- NOTE: GoTrue (Go) scans email_change, phone_change, phone_change_token etc. into
-- Go string types which cannot be NULL. All these columns MUST be empty strings.
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current, email_change_confirm_status, phone_change, phone_change_token, reauthentication_token, is_sso_user)
VALUES
  ('c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'sarah.johnson@example.com', crypt('Password123!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Sarah","last_name":"Johnson","role":"patient"}',
   NOW(), NOW(), '', '', '', '', '', 0, '', '', '', FALSE),
  ('c0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'michael.chen@example.com', crypt('Password123!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Michael","last_name":"Chen","role":"patient"}',
   NOW(), NOW(), '', '', '', '', '', 0, '', '', '', FALSE),
  ('c0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'emma.wilson@example.com', crypt('Password123!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Emma","last_name":"Wilson","role":"patient"}',
   NOW(), NOW(), '', '', '', '', '', 0, '', '', '', FALSE),
  -- Doctors
  ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'hans.mueller@example.com', crypt('Password123!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Hans","last_name":"Mueller","role":"doctor"}',
   NOW(), NOW(), '', '', '', '', '', 0, '', '', '', FALSE),
  ('d0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ayse.yilmaz@example.com', crypt('Password123!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Ayşe","last_name":"Yılmaz","role":"doctor"}',
   NOW(), NOW(), '', '', '', '', '', 0, '', '', '', FALSE),
  ('d0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'james.thompson@example.com', crypt('Password123!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"James","last_name":"Thompson","role":"doctor"}',
   NOW(), NOW(), '', '', '', '', '', 0, '', '', '', FALSE),
  ('d0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'marie.dubois@example.com', crypt('Password123!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Marie","last_name":"Dubois","role":"doctor"}',
   NOW(), NOW(), '', '', '', '', '', 0, '', '', '', FALSE),
  ('d0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'lisa.vanberg@example.com', crypt('Password123!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Lisa","last_name":"van Berg","role":"doctor"}',
   NOW(), NOW(), '', '', '', '', '', 0, '', '', '', FALSE),
  ('d0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'kenji.tanaka@example.com', crypt('Password123!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Kenji","last_name":"Tanaka","role":"doctor"}',
   NOW(), NOW(), '', '', '', '', '', 0, '', '', '', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Auth identities (required for Supabase email/password login)
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   '{"sub":"c0000000-0000-0000-0000-000000000001","email":"sarah.johnson@example.com"}',
   'email', 'c0000000-0000-0000-0000-000000000001', NOW(), NOW(), NOW()),
  ('c0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002',
   '{"sub":"c0000000-0000-0000-0000-000000000002","email":"michael.chen@example.com"}',
   'email', 'c0000000-0000-0000-0000-000000000002', NOW(), NOW(), NOW()),
  ('c0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003',
   '{"sub":"c0000000-0000-0000-0000-000000000003","email":"emma.wilson@example.com"}',
   'email', 'c0000000-0000-0000-0000-000000000003', NOW(), NOW(), NOW()),
  ('d0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
   '{"sub":"d0000000-0000-0000-0000-000000000001","email":"hans.mueller@example.com"}',
   'email', 'd0000000-0000-0000-0000-000000000001', NOW(), NOW(), NOW()),
  ('d0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002',
   '{"sub":"d0000000-0000-0000-0000-000000000002","email":"ayse.yilmaz@example.com"}',
   'email', 'd0000000-0000-0000-0000-000000000002', NOW(), NOW(), NOW()),
  ('d0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003',
   '{"sub":"d0000000-0000-0000-0000-000000000003","email":"james.thompson@example.com"}',
   'email', 'd0000000-0000-0000-0000-000000000003', NOW(), NOW(), NOW()),
  ('d0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004',
   '{"sub":"d0000000-0000-0000-0000-000000000004","email":"marie.dubois@example.com"}',
   'email', 'd0000000-0000-0000-0000-000000000004', NOW(), NOW(), NOW()),
  ('d0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000005',
   '{"sub":"d0000000-0000-0000-0000-000000000005","email":"lisa.vanberg@example.com"}',
   'email', 'd0000000-0000-0000-0000-000000000005', NOW(), NOW(), NOW()),
  ('d0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000006',
   '{"sub":"d0000000-0000-0000-0000-000000000006","email":"kenji.tanaka@example.com"}',
   'email', 'd0000000-0000-0000-0000-000000000006', NOW(), NOW(), NOW())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. UPDATE PROFILES (trigger auto-created them)
-- ============================================================================
UPDATE public.profiles SET phone = '+49 170 1234567', preferred_currency = 'EUR' WHERE id = 'c0000000-0000-0000-0000-000000000001';
UPDATE public.profiles SET phone = '+44 7911 123456', preferred_currency = 'GBP' WHERE id = 'c0000000-0000-0000-0000-000000000002';
UPDATE public.profiles SET phone = '+33 6 12 34 56 78', preferred_currency = 'EUR' WHERE id = 'c0000000-0000-0000-0000-000000000003';
UPDATE public.profiles SET role = 'doctor' WHERE id IN (
  'd0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002',
  'd0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004',
  'd0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000006'
);

-- ============================================================================
-- 6. DOCTORS
-- ============================================================================
INSERT INTO public.doctors (
  id, profile_id, slug, title, bio, years_of_experience,
  education, certifications, languages, consultation_types,
  location_id, address, clinic_name, base_currency,
  consultation_fee_cents, video_consultation_fee_cents,
  verification_status, verified_at, is_active, is_featured,
  cancellation_policy, cancellation_hours,
  stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled
) VALUES
  -- Dr. Hans Mueller - Cardiologist, Berlin
  (
    'e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001',
    'dr-hans-mueller', 'Prof. Dr.',
    'Professor of Cardiology at Charité Berlin with over 20 years of experience in interventional cardiology and cardiac imaging. Specializing in heart failure management, arrhythmias, and preventive cardiology. Published over 50 research papers in leading medical journals.',
    22,
    '[{"degree":"Dr. med.","institution":"Charité – Universitätsmedizin Berlin","year":2002},{"degree":"Habilitation in Cardiology","institution":"Charité Berlin","year":2008}]',
    '[{"name":"European Society of Cardiology Fellow","issuer":"ESC","year":2010},{"name":"Board Certified Cardiologist","issuer":"German Medical Association","year":2005}]',
    '{German,English,French}', '{in_person,video}',
    (SELECT id FROM public.locations WHERE slug = 'berlin-germany'),
    'Charitéplatz 1, 10117 Berlin', 'Charité Heart Center', 'EUR',
    15000, 12000,
    'verified', NOW() - INTERVAL '6 months', TRUE, TRUE,
    'moderate', 24,
    'acct_seed_mueller', TRUE, TRUE
  ),
  -- Dr. Ayse Yilmaz - Dermatologist, Istanbul
  (
    'e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000002',
    'dr-ayse-yilmaz', 'Dr.',
    'Board-certified dermatologist specializing in cosmetic dermatology, acne treatment, and skin cancer screening. Known for a patient-centered approach combining the latest treatments with holistic skincare guidance. Fluent in Turkish, English, and German.',
    12,
    '[{"degree":"MD","institution":"Istanbul University Faculty of Medicine","year":2012},{"degree":"Dermatology Residency","institution":"Cerrahpaşa Medical Faculty","year":2016}]',
    '[{"name":"Turkish Dermatology Society Member","issuer":"TDS","year":2016},{"name":"EADV Certification","issuer":"European Academy of Dermatology","year":2018}]',
    '{Turkish,English,German}', '{in_person,video}',
    (SELECT id FROM public.locations WHERE slug = 'istanbul-turkey'),
    'Bağdat Caddesi No:42, Kadıköy, Istanbul', 'Yılmaz Dermatoloji Kliniği', 'TRY',
    350000, 280000,
    'verified', NOW() - INTERVAL '4 months', TRUE, TRUE,
    'flexible', 12,
    'acct_seed_yilmaz', TRUE, TRUE
  ),
  -- Dr. James Thompson - GP, London
  (
    'e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000003',
    'dr-james-thompson', 'Dr.',
    'Experienced GP with a passion for family medicine and preventive healthcare. Offers comprehensive health check-ups, chronic disease management, and mental health support. Strong believer in building long-term patient-doctor relationships.',
    15,
    '[{"degree":"MBBS","institution":"King''s College London","year":2009},{"degree":"MRCGP","institution":"Royal College of General Practitioners","year":2013}]',
    '[{"name":"MRCGP","issuer":"Royal College of GPs","year":2013},{"name":"Diploma in Sports Medicine","issuer":"Bath University","year":2015}]',
    '{English,Spanish}', '{in_person,video}',
    (SELECT id FROM public.locations WHERE slug = 'london-uk'),
    '25 Harley Street, London W1G 9QW', 'Harley Street Family Practice', 'GBP',
    12000, 9500,
    'verified', NOW() - INTERVAL '8 months', TRUE, FALSE,
    'flexible', 24,
    'acct_seed_thompson', TRUE, TRUE
  ),
  -- Dr. Marie Dubois - Psychiatrist, Paris
  (
    'e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000004',
    'dr-marie-dubois', 'Dr.',
    'Psychiatrist specializing in anxiety disorders, depression, and cognitive behavioral therapy. Bilingual practice offering therapy sessions in both French and English. Particularly experienced with expat mental health and cross-cultural challenges.',
    10,
    '[{"degree":"MD Psychiatry","institution":"Université Paris Descartes","year":2014},{"degree":"DU in CBT","institution":"Université Pierre et Marie Curie","year":2016}]',
    '[{"name":"French Board of Psychiatry","issuer":"Ordre des Médecins","year":2015},{"name":"CBT Practitioner Certificate","issuer":"AFTCC","year":2016}]',
    '{French,English}', '{in_person,video}',
    (SELECT id FROM public.locations WHERE slug = 'paris-france'),
    '15 Rue de la Paix, 75002 Paris', 'Cabinet Dubois Psychiatrie', 'EUR',
    13000, 11000,
    'verified', NOW() - INTERVAL '3 months', TRUE, FALSE,
    'moderate', 48,
    'acct_seed_dubois', TRUE, TRUE
  ),
  -- Dr. Lisa van Berg - Pediatrician, Amsterdam
  (
    'e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000005',
    'dr-lisa-van-berg', 'Dr.',
    'Dedicated pediatrician with expertise in childhood development, vaccinations, and adolescent health. Warm and friendly approach that puts both children and parents at ease. Offers weekend appointments for busy families.',
    8,
    '[{"degree":"MD","institution":"University of Amsterdam","year":2016},{"degree":"Pediatrics Residency","institution":"Emma Children''s Hospital AMC","year":2020}]',
    '[{"name":"Dutch Pediatric Society Member","issuer":"NVK","year":2020},{"name":"Neonatal Life Support","issuer":"European Resuscitation Council","year":2021}]',
    '{Dutch,English,German}', '{in_person,video}',
    (SELECT id FROM public.locations WHERE slug = 'amsterdam-netherlands'),
    'Keizersgracht 452, 1016 GD Amsterdam', 'Amsterdam Kids Clinic', 'EUR',
    11000, 9000,
    'verified', NOW() - INTERVAL '5 months', TRUE, TRUE,
    'flexible', 12,
    'acct_seed_vanberg', TRUE, TRUE
  ),
  -- Dr. Kenji Tanaka - Orthopedics, Vienna
  (
    'e0000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000006',
    'dr-kenji-tanaka', 'Dr.',
    'Orthopedic surgeon specializing in sports injuries, joint replacement, and minimally invasive surgery. Former team physician for Austrian national ski team. Combines Western and Eastern medical approaches for holistic patient care.',
    18,
    '[{"degree":"MD","institution":"Medical University of Vienna","year":2006},{"degree":"Fellowship in Sports Medicine","institution":"Osaka University","year":2010}]',
    '[{"name":"Austrian Orthopedic Society","issuer":"ÖGO","year":2008},{"name":"ISAKOS Sports Medicine","issuer":"ISAKOS","year":2012}]',
    '{German,English,Japanese}', '{in_person}',
    (SELECT id FROM public.locations WHERE slug = 'vienna-austria'),
    'Währinger Gürtel 18-20, 1090 Wien', 'Vienna Sports & Orthopedic Center', 'EUR',
    18000, NULL,
    'verified', NOW() - INTERVAL '7 months', TRUE, FALSE,
    'strict', 72,
    'acct_seed_tanaka', TRUE, TRUE
  )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 7. DOCTOR SPECIALTIES
-- ============================================================================
INSERT INTO public.doctor_specialties (doctor_id, specialty_id, is_primary) VALUES
  ('e0000000-0000-0000-0000-000000000001', (SELECT id FROM specialties WHERE slug='cardiology'), TRUE),
  ('e0000000-0000-0000-0000-000000000001', (SELECT id FROM specialties WHERE slug='general-practice'), FALSE),
  ('e0000000-0000-0000-0000-000000000002', (SELECT id FROM specialties WHERE slug='dermatology'), TRUE),
  ('e0000000-0000-0000-0000-000000000002', (SELECT id FROM specialties WHERE slug='aesthetic-medicine'), FALSE),
  ('e0000000-0000-0000-0000-000000000003', (SELECT id FROM specialties WHERE slug='general-practice'), TRUE),
  ('e0000000-0000-0000-0000-000000000003', (SELECT id FROM specialties WHERE slug='nutrition'), FALSE),
  ('e0000000-0000-0000-0000-000000000004', (SELECT id FROM specialties WHERE slug='psychiatry'), TRUE),
  ('e0000000-0000-0000-0000-000000000004', (SELECT id FROM specialties WHERE slug='psychology'), FALSE),
  ('e0000000-0000-0000-0000-000000000005', (SELECT id FROM specialties WHERE slug='pediatrics'), TRUE),
  ('e0000000-0000-0000-0000-000000000005', (SELECT id FROM specialties WHERE slug='allergy'), FALSE),
  ('e0000000-0000-0000-0000-000000000006', (SELECT id FROM specialties WHERE slug='orthopedics'), TRUE),
  ('e0000000-0000-0000-0000-000000000006', (SELECT id FROM specialties WHERE slug='physiotherapy'), FALSE)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 8. AVAILABILITY SCHEDULES
-- ============================================================================
-- Dr. Mueller: Mon-Fri 9-17 in-person, Mon/Wed/Fri 14-17 video
INSERT INTO public.availability_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, consultation_type) VALUES
  ('e0000000-0000-0000-0000-000000000001', 1, '09:00', '17:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000001', 2, '09:00', '17:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000001', 3, '09:00', '17:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000001', 4, '09:00', '17:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000001', 5, '09:00', '17:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000001', 1, '14:00', '17:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000001', 3, '14:00', '17:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000001', 5, '14:00', '17:00', 30, 'video');

-- Dr. Yilmaz: Mon-Sat 10-18 in-person, Mon/Wed/Fri 10-13 video
INSERT INTO public.availability_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, consultation_type) VALUES
  ('e0000000-0000-0000-0000-000000000002', 1, '10:00', '18:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000002', 2, '10:00', '18:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000002', 3, '10:00', '18:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000002', 4, '10:00', '18:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000002', 5, '10:00', '18:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000002', 6, '10:00', '14:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000002', 1, '10:00', '13:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000002', 3, '10:00', '13:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000002', 5, '10:00', '13:00', 30, 'video');

-- Dr. Thompson: Mon-Fri 8-16 in-person (20min slots), Tue/Thu 16-19 video
INSERT INTO public.availability_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, consultation_type) VALUES
  ('e0000000-0000-0000-0000-000000000003', 1, '08:00', '16:00', 20, 'in_person'),
  ('e0000000-0000-0000-0000-000000000003', 2, '08:00', '16:00', 20, 'in_person'),
  ('e0000000-0000-0000-0000-000000000003', 3, '08:00', '16:00', 20, 'in_person'),
  ('e0000000-0000-0000-0000-000000000003', 4, '08:00', '16:00', 20, 'in_person'),
  ('e0000000-0000-0000-0000-000000000003', 5, '08:00', '16:00', 20, 'in_person'),
  ('e0000000-0000-0000-0000-000000000003', 2, '16:00', '19:00', 20, 'video'),
  ('e0000000-0000-0000-0000-000000000003', 4, '16:00', '19:00', 20, 'video');

-- Dr. Dubois: Mon-Thu 10-18 in-person + video (50min therapy sessions)
INSERT INTO public.availability_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, consultation_type) VALUES
  ('e0000000-0000-0000-0000-000000000004', 1, '10:00', '18:00', 50, 'in_person'),
  ('e0000000-0000-0000-0000-000000000004', 2, '10:00', '18:00', 50, 'in_person'),
  ('e0000000-0000-0000-0000-000000000004', 3, '10:00', '18:00', 50, 'in_person'),
  ('e0000000-0000-0000-0000-000000000004', 4, '10:00', '18:00', 50, 'in_person'),
  ('e0000000-0000-0000-0000-000000000004', 1, '10:00', '18:00', 50, 'video'),
  ('e0000000-0000-0000-0000-000000000004', 2, '10:00', '18:00', 50, 'video'),
  ('e0000000-0000-0000-0000-000000000004', 3, '10:00', '18:00', 50, 'video'),
  ('e0000000-0000-0000-0000-000000000004', 4, '10:00', '18:00', 50, 'video');

-- Dr. van Berg: Mon-Fri 8:30-17 + Sat morning, video Mon/Wed/Fri
INSERT INTO public.availability_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, consultation_type) VALUES
  ('e0000000-0000-0000-0000-000000000005', 1, '08:30', '17:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000005', 2, '08:30', '17:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000005', 3, '08:30', '17:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000005', 4, '08:30', '17:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000005', 5, '08:30', '17:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000005', 6, '09:00', '12:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000005', 1, '13:00', '17:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000005', 3, '13:00', '17:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000005', 5, '13:00', '17:00', 30, 'video');

-- Dr. Tanaka: Mon-Fri 8-16 in-person only
INSERT INTO public.availability_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, consultation_type) VALUES
  ('e0000000-0000-0000-0000-000000000006', 1, '08:00', '16:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000006', 2, '08:00', '16:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000006', 3, '08:00', '16:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000006', 4, '08:00', '16:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000006', 5, '08:00', '16:00', 30, 'in_person');

-- ============================================================================
-- 9. BOOKINGS (8 completed + 3 upcoming)
-- ============================================================================
INSERT INTO public.bookings (id, booking_number, patient_id, doctor_id, appointment_date, start_time, end_time, consultation_type, status, currency, consultation_fee_cents, platform_fee_cents, total_amount_cents, paid_at) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'BK-20250115-S001',
   'c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
   '2025-01-15', '2025-01-15 09:00:00+01', '2025-01-15 09:30:00+01',
   'in_person', 'completed', 'EUR', 15000, 2250, 17250, '2025-01-14 18:00:00+01'),
  ('f0000000-0000-0000-0000-000000000002', 'BK-20250120-M001',
   'c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003',
   '2025-01-20', '2025-01-20 16:00:00+00', '2025-01-20 16:20:00+00',
   'video', 'completed', 'GBP', 9500, 1425, 10925, '2025-01-19 12:00:00+00'),
  ('f0000000-0000-0000-0000-000000000003', 'BK-20250125-E001',
   'c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000004',
   '2025-01-25', '2025-01-25 14:00:00+01', '2025-01-25 14:50:00+01',
   'video', 'completed', 'EUR', 11000, 1650, 12650, '2025-01-24 10:00:00+01'),
  ('f0000000-0000-0000-0000-000000000004', 'BK-20250201-S002',
   'c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002',
   '2025-02-01', '2025-02-01 11:00:00+03', '2025-02-01 11:30:00+03',
   'in_person', 'completed', 'TRY', 350000, 52500, 402500, '2025-01-31 14:00:00+03'),
  ('f0000000-0000-0000-0000-000000000005', 'BK-20250205-M002',
   'c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000005',
   '2025-02-05', '2025-02-05 10:00:00+01', '2025-02-05 10:30:00+01',
   'in_person', 'completed', 'EUR', 11000, 1650, 12650, '2025-02-04 15:00:00+01'),
  ('f0000000-0000-0000-0000-000000000006', 'BK-20250210-E002',
   'c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001',
   '2025-02-10', '2025-02-10 14:00:00+01', '2025-02-10 14:30:00+01',
   'video', 'completed', 'EUR', 12000, 1800, 13800, '2025-02-09 11:00:00+01'),
  ('f0000000-0000-0000-0000-000000000007', 'BK-20250215-S003',
   'c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000006',
   '2025-02-15', '2025-02-15 09:00:00+01', '2025-02-15 09:30:00+01',
   'in_person', 'completed', 'EUR', 18000, 2700, 20700, '2025-02-14 14:00:00+01'),
  ('f0000000-0000-0000-0000-000000000008', 'BK-20250218-M003',
   'c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000004',
   '2025-02-18', '2025-02-18 11:00:00+01', '2025-02-18 11:50:00+01',
   'video', 'completed', 'EUR', 11000, 1650, 12650, '2025-02-17 09:00:00+01'),
  -- Upcoming
  ('f0000000-0000-0000-0000-000000000009', 'BK-20260301-S004',
   'c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
   '2026-03-01', '2026-03-01 10:00:00+01', '2026-03-01 10:30:00+01',
   'in_person', 'confirmed', 'EUR', 15000, 2250, 17250, '2026-02-24 12:00:00+01'),
  ('f0000000-0000-0000-0000-000000000010', 'BK-20260303-E003',
   'c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000005',
   '2026-03-03', '2026-03-03 14:00:00+01', '2026-03-03 14:30:00+01',
   'video', 'confirmed', 'EUR', 9000, 1350, 10350, '2026-02-24 10:00:00+01'),
  ('f0000000-0000-0000-0000-000000000011', 'BK-20260305-M004',
   'c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003',
   '2026-03-05', '2026-03-05 16:30:00+00', '2026-03-05 16:50:00+00',
   'video', 'confirmed', 'GBP', 9500, 1425, 10925, '2026-02-23 14:00:00+00');

-- ============================================================================
-- 10. REVIEWS (for completed bookings - triggers update avg_rating)
-- ============================================================================
INSERT INTO public.reviews (booking_id, patient_id, doctor_id, rating, title, comment, doctor_response, doctor_responded_at) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001',
   5, 'Exceptional cardiac care',
   'Prof. Mueller was incredibly thorough with my cardiac screening. He took the time to explain every test result and created a clear prevention plan. Highly recommended.',
   'Thank you for the kind words, Sarah. It was a pleasure helping you with your cardiac health!', NOW() - INTERVAL '2 months'),
  ('f0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003',
   4, 'Great video consultation',
   'Dr. Thompson was very professional during our video call. He listened carefully to my symptoms and provided a clear diagnosis. Overall a great experience.',
   'Thank you, Michael. Glad you found the consultation helpful!', NOW() - INTERVAL '1 month'),
  ('f0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000004',
   5, 'Life-changing therapy sessions',
   'Dr. Dubois has been wonderful. Her approach to CBT is both professional and compassionate. The video sessions work really well. I have seen real improvements.',
   'Thank you for sharing your experience. Looking forward to continuing our work together.', NOW() - INTERVAL '3 weeks'),
  ('f0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002',
   5, 'Amazing dermatologist',
   'Dr. Yılmaz correctly diagnosed my skin condition on the first visit. Her clinic is modern and clean. She speaks excellent English which made everything easy.',
   NULL, NULL),
  ('f0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000005',
   5, 'Wonderful with children',
   'Dr. van Berg was amazing with our son. She made him feel comfortable right away. The Saturday availability is a lifesaver for working parents.',
   NULL, NULL),
  ('f0000000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001',
   4, 'Thorough video consultation',
   'Had a follow-up video call with Prof. Mueller. Very convenient and professional. He reviewed my test results in detail and adjusted my medication.',
   NULL, NULL),
  ('f0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000006',
   5, 'Expert orthopedic surgeon',
   'Dr. Tanaka examined my knee injury with great expertise. His diagnosis was spot-on and he explained all treatment options clearly.',
   NULL, NULL),
  ('f0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000004',
   4, 'Helpful therapy session',
   'Dr. Dubois provided insightful guidance. Her CBT techniques are practical and easy to apply in daily life. Video format works well for therapy.',
   NULL, NULL);

-- ============================================================================
-- 11. UPDATE DOCTOR BOOKING COUNTS
-- ============================================================================
UPDATE public.doctors SET total_bookings = (
  SELECT COUNT(*) FROM public.bookings b
  WHERE b.doctor_id = doctors.id AND b.status IN ('completed', 'confirmed', 'approved')
);

-- ============================================================================
-- 12. FAVORITES
-- ============================================================================
INSERT INTO public.favorites (patient_id, doctor_id) VALUES
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000003'),
  ('c0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000005'),
  ('c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000004')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 13. REMINDER PREFERENCES
-- ============================================================================
INSERT INTO public.doctor_reminder_preferences (doctor_id, minutes_before, channel, is_enabled) VALUES
  ('e0000000-0000-0000-0000-000000000001', 1440, 'email', TRUE),
  ('e0000000-0000-0000-0000-000000000001', 60, 'email', TRUE),
  ('e0000000-0000-0000-0000-000000000001', 60, 'in_app', TRUE),
  ('e0000000-0000-0000-0000-000000000004', 2880, 'email', TRUE),
  ('e0000000-0000-0000-0000-000000000004', 1440, 'email', TRUE),
  ('e0000000-0000-0000-0000-000000000004', 60, 'email', TRUE),
  ('e0000000-0000-0000-0000-000000000004', 30, 'in_app', TRUE)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 14. UK EXPANSION — 6 additional UK doctors for nationwide testing
-- ============================================================================

-- Extra UK locations
INSERT INTO public.locations (country_code, city, slug, latitude, longitude, timezone) VALUES
  ('GB', 'Leeds', 'leeds-uk', 53.80076300, -1.54907740, 'Europe/London'),
  ('GB', 'Bristol', 'bristol-uk', 51.45451300, -2.58791000, 'Europe/London'),
  ('GB', 'Liverpool', 'liverpool-uk', 53.40840800, -2.99157400, 'Europe/London'),
  ('GB', 'Glasgow', 'glasgow-uk', 55.86423700, -4.25180600, 'Europe/London')
ON CONFLICT (slug) DO NOTHING;

-- Auth users for new UK doctors (all password: Password123!)
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current, email_change_confirm_status, phone_change, phone_change_token, reauthentication_token, is_sso_user)
VALUES
  ('d0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'rachel.patel@example.com', crypt('Password123!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Rachel","last_name":"Patel","role":"doctor"}',
   NOW(), NOW(), '', '', '', '', '', 0, '', '', '', FALSE),
  ('d0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'william.hughes@example.com', crypt('Password123!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"William","last_name":"Hughes","role":"doctor"}',
   NOW(), NOW(), '', '', '', '', '', 0, '', '', '', FALSE),
  ('d0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'fiona.campbell@example.com', crypt('Password123!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Fiona","last_name":"Campbell","role":"doctor"}',
   NOW(), NOW(), '', '', '', '', '', 0, '', '', '', FALSE),
  ('d0000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'oliver.wright@example.com', crypt('Password123!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Oliver","last_name":"Wright","role":"doctor"}',
   NOW(), NOW(), '', '', '', '', '', 0, '', '', '', FALSE),
  ('d0000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'priya.sharma@example.com', crypt('Password123!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Priya","last_name":"Sharma","role":"doctor"}',
   NOW(), NOW(), '', '', '', '', '', 0, '', '', '', FALSE),
  ('d0000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'david.evans@example.com', crypt('Password123!', gen_salt('bf')), NOW(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"David","last_name":"Evans","role":"doctor"}',
   NOW(), NOW(), '', '', '', '', '', 0, '', '', '', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Auth identities
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES
  ('d0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000007',
   '{"sub":"d0000000-0000-0000-0000-000000000007","email":"rachel.patel@example.com"}',
   'email', 'd0000000-0000-0000-0000-000000000007', NOW(), NOW(), NOW()),
  ('d0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000008',
   '{"sub":"d0000000-0000-0000-0000-000000000008","email":"william.hughes@example.com"}',
   'email', 'd0000000-0000-0000-0000-000000000008', NOW(), NOW(), NOW()),
  ('d0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000009',
   '{"sub":"d0000000-0000-0000-0000-000000000009","email":"fiona.campbell@example.com"}',
   'email', 'd0000000-0000-0000-0000-000000000009', NOW(), NOW(), NOW()),
  ('d0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000a',
   '{"sub":"d0000000-0000-0000-0000-00000000000a","email":"oliver.wright@example.com"}',
   'email', 'd0000000-0000-0000-0000-00000000000a', NOW(), NOW(), NOW()),
  ('d0000000-0000-0000-0000-00000000000b', 'd0000000-0000-0000-0000-00000000000b',
   '{"sub":"d0000000-0000-0000-0000-00000000000b","email":"priya.sharma@example.com"}',
   'email', 'd0000000-0000-0000-0000-00000000000b', NOW(), NOW(), NOW()),
  ('d0000000-0000-0000-0000-00000000000c', 'd0000000-0000-0000-0000-00000000000c',
   '{"sub":"d0000000-0000-0000-0000-00000000000c","email":"david.evans@example.com"}',
   'email', 'd0000000-0000-0000-0000-00000000000c', NOW(), NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Set doctor role on profiles
UPDATE public.profiles SET role = 'doctor' WHERE id IN (
  'd0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000008',
  'd0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-00000000000a',
  'd0000000-0000-0000-0000-00000000000b', 'd0000000-0000-0000-0000-00000000000c'
);

-- UK Doctors
INSERT INTO public.doctors (
  id, profile_id, slug, title, bio, years_of_experience,
  education, certifications, languages, consultation_types,
  location_id, address, clinic_name, base_currency,
  consultation_fee_cents, video_consultation_fee_cents,
  verification_status, verified_at, is_active, is_featured,
  cancellation_policy, cancellation_hours,
  stripe_account_id, stripe_onboarding_complete, stripe_payouts_enabled
) VALUES
  -- Dr. Rachel Patel - Dermatologist, Manchester
  (
    'e0000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000007',
    'dr-rachel-patel', 'Dr.',
    'Consultant dermatologist with a special interest in skin cancer, eczema management, and cosmetic dermatology. Trained at Manchester Royal Infirmary with additional fellowship in Mohs surgery. Passionate about accessible skincare for diverse skin types.',
    14,
    '[{"degree":"MBChB","institution":"University of Manchester","year":2010},{"degree":"MRCP Dermatology","institution":"Royal College of Physicians","year":2015}]',
    '[{"name":"British Association of Dermatologists","issuer":"BAD","year":2015},{"name":"Diploma in Dermoscopy","issuer":"Cardiff University","year":2017}]',
    '{English,Hindi,Gujarati}', '{in_person,video}',
    (SELECT id FROM public.locations WHERE slug = 'manchester-uk'),
    '82 King Street, Manchester M2 4WQ', 'Manchester Skin Clinic', 'GBP',
    14000, 11000,
    'verified', NOW() - INTERVAL '7 months', TRUE, TRUE,
    'flexible', 24,
    'acct_seed_patel', TRUE, TRUE
  ),
  -- Dr. William Hughes - Cardiologist, Birmingham
  (
    'e0000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000008',
    'dr-william-hughes', 'Dr.',
    'Senior consultant cardiologist at Queen Elizabeth Hospital Birmingham. Expert in heart rhythm disorders, echocardiography, and cardiac rehabilitation. Actively involved in clinical research and patient education programmes across the West Midlands.',
    20,
    '[{"degree":"MBBS","institution":"University of Birmingham","year":2004},{"degree":"PhD Cardiovascular Medicine","institution":"University of Oxford","year":2010}]',
    '[{"name":"Fellow of the Royal College of Physicians","issuer":"FRCP","year":2014},{"name":"European Heart Rhythm Association","issuer":"EHRA","year":2016}]',
    '{English,Welsh}', '{in_person,video}',
    (SELECT id FROM public.locations WHERE slug = 'birmingham-uk'),
    '42 Harborne Road, Edgbaston, Birmingham B15 3HE', 'Birmingham Heart Centre', 'GBP',
    18000, 15000,
    'verified', NOW() - INTERVAL '10 months', TRUE, TRUE,
    'moderate', 48,
    'acct_seed_hughes', TRUE, TRUE
  ),
  -- Dr. Fiona Campbell - Neurologist, Edinburgh
  (
    'e0000000-0000-0000-0000-000000000009', 'd0000000-0000-0000-0000-000000000009',
    'dr-fiona-campbell', 'Dr.',
    'Consultant neurologist specialising in headache disorders, epilepsy, and multiple sclerosis. Based at the Royal Infirmary of Edinburgh with a holistic approach combining clinical excellence with compassionate care. Regular lecturer at the University of Edinburgh.',
    12,
    '[{"degree":"MBChB","institution":"University of Edinburgh","year":2012},{"degree":"MRCP Neurology","institution":"Royal College of Physicians Edinburgh","year":2017}]',
    '[{"name":"Association of British Neurologists","issuer":"ABN","year":2017},{"name":"Headache Specialist Certification","issuer":"IHS","year":2019}]',
    '{English,Scottish Gaelic}', '{in_person,video}',
    (SELECT id FROM public.locations WHERE slug = 'edinburgh-uk'),
    '1 Lauriston Place, Edinburgh EH3 9YW', 'Edinburgh Neuroscience Clinic', 'GBP',
    16000, 13000,
    'verified', NOW() - INTERVAL '5 months', TRUE, FALSE,
    'moderate', 24,
    'acct_seed_campbell', TRUE, TRUE
  ),
  -- Dr. Oliver Wright - Dentist, London
  (
    'e0000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-00000000000a',
    'dr-oliver-wright', 'Dr.',
    'Award-winning cosmetic and general dentist with practices in Central London. Specialising in Invisalign, dental implants, and smile makeovers. Known for a gentle, anxiety-free approach using the latest digital dentistry technology.',
    10,
    '[{"degree":"BDS","institution":"King''s College London","year":2014},{"degree":"MSc Prosthodontics","institution":"UCL Eastman Dental Institute","year":2018}]',
    '[{"name":"Royal College of Surgeons","issuer":"MJDF RCS","year":2016},{"name":"Invisalign Diamond Provider","issuer":"Align Technology","year":2020}]',
    '{English,French}', '{in_person,video}',
    (SELECT id FROM public.locations WHERE slug = 'london-uk'),
    '58 Wimpole Street, London W1G 8YJ', 'Wimpole Dental Studio', 'GBP',
    15000, 8000,
    'verified', NOW() - INTERVAL '6 months', TRUE, TRUE,
    'flexible', 24,
    'acct_seed_wright', TRUE, TRUE
  ),
  -- Dr. Priya Sharma - Physiotherapist, Leeds
  (
    'e0000000-0000-0000-0000-00000000000b', 'd0000000-0000-0000-0000-00000000000b',
    'dr-priya-sharma', 'Dr.',
    'Chartered physiotherapist and sports injury specialist. Former physiotherapist for Yorkshire County Cricket Club. Expert in musculoskeletal rehabilitation, post-operative recovery, and chronic pain management using evidence-based techniques.',
    9,
    '[{"degree":"BSc Physiotherapy","institution":"University of Leeds","year":2015},{"degree":"MSc Sports Medicine","institution":"University of Bath","year":2018}]',
    '[{"name":"Chartered Society of Physiotherapy","issuer":"CSP","year":2015},{"name":"Sports and Exercise Medicine","issuer":"BASEM","year":2019}]',
    '{English,Hindi,Punjabi}', '{in_person,video}',
    (SELECT id FROM public.locations WHERE slug = 'leeds-uk'),
    '14 Park Square East, Leeds LS1 2LH', 'Leeds Sports Physio Centre', 'GBP',
    9000, 7000,
    'verified', NOW() - INTERVAL '4 months', TRUE, FALSE,
    'flexible', 12,
    'acct_seed_sharma', TRUE, TRUE
  ),
  -- Dr. David Evans - Psychiatrist, Bristol
  (
    'e0000000-0000-0000-0000-00000000000c', 'd0000000-0000-0000-0000-00000000000c',
    'dr-david-evans', 'Dr.',
    'Consultant psychiatrist specialising in adult ADHD, anxiety, and depression. Pioneer of digital mental health solutions in the South West. Combines medication management with practical coping strategies for lasting improvements.',
    16,
    '[{"degree":"MBBS","institution":"University of Bristol","year":2008},{"degree":"MRCPsych","institution":"Royal College of Psychiatrists","year":2013}]',
    '[{"name":"Royal College of Psychiatrists","issuer":"MRCPsych","year":2013},{"name":"ADHD Foundation Clinical Fellow","issuer":"ADHD Foundation","year":2018}]',
    '{English}', '{in_person,video}',
    (SELECT id FROM public.locations WHERE slug = 'bristol-uk'),
    '29 Queens Road, Clifton, Bristol BS8 1QE', 'Clifton Mind & Wellness', 'GBP',
    17000, 14000,
    'verified', NOW() - INTERVAL '9 months', TRUE, FALSE,
    'moderate', 48,
    'acct_seed_evans', TRUE, TRUE
  )
ON CONFLICT (slug) DO NOTHING;

-- UK Doctor Specialties
INSERT INTO public.doctor_specialties (doctor_id, specialty_id, is_primary) VALUES
  ('e0000000-0000-0000-0000-000000000007', (SELECT id FROM specialties WHERE slug='dermatology'), TRUE),
  ('e0000000-0000-0000-0000-000000000007', (SELECT id FROM specialties WHERE slug='aesthetic-medicine'), FALSE),
  ('e0000000-0000-0000-0000-000000000008', (SELECT id FROM specialties WHERE slug='cardiology'), TRUE),
  ('e0000000-0000-0000-0000-000000000008', (SELECT id FROM specialties WHERE slug='general-practice'), FALSE),
  ('e0000000-0000-0000-0000-000000000009', (SELECT id FROM specialties WHERE slug='neurology'), TRUE),
  ('e0000000-0000-0000-0000-000000000009', (SELECT id FROM specialties WHERE slug='psychiatry'), FALSE),
  ('e0000000-0000-0000-0000-00000000000a', (SELECT id FROM specialties WHERE slug='dentistry'), TRUE),
  ('e0000000-0000-0000-0000-00000000000a', (SELECT id FROM specialties WHERE slug='aesthetic-medicine'), FALSE),
  ('e0000000-0000-0000-0000-00000000000b', (SELECT id FROM specialties WHERE slug='physiotherapy'), TRUE),
  ('e0000000-0000-0000-0000-00000000000b', (SELECT id FROM specialties WHERE slug='orthopedics'), FALSE),
  ('e0000000-0000-0000-0000-00000000000c', (SELECT id FROM specialties WHERE slug='psychiatry'), TRUE),
  ('e0000000-0000-0000-0000-00000000000c', (SELECT id FROM specialties WHERE slug='psychology'), FALSE)
ON CONFLICT DO NOTHING;

-- UK Doctor Availability: ALL 7 DAYS, both in_person + video (for testing)
-- day_of_week: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat

-- Dr. Patel (Manchester) — 9-18 in-person, 9-18 video, 30min slots, 7 days
INSERT INTO public.availability_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, consultation_type) VALUES
  ('e0000000-0000-0000-0000-000000000007', 0, '10:00', '16:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000007', 0, '10:00', '16:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000007', 1, '09:00', '18:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000007', 1, '09:00', '18:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000007', 2, '09:00', '18:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000007', 2, '09:00', '18:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000007', 3, '09:00', '18:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000007', 3, '09:00', '18:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000007', 4, '09:00', '18:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000007', 4, '09:00', '18:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000007', 5, '09:00', '18:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000007', 5, '09:00', '18:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000007', 6, '10:00', '16:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000007', 6, '10:00', '16:00', 30, 'video');

-- Dr. Hughes (Birmingham) — 8-17 in-person, 8-17 video, 30min slots, 7 days
INSERT INTO public.availability_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, consultation_type) VALUES
  ('e0000000-0000-0000-0000-000000000008', 0, '10:00', '15:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000008', 0, '10:00', '15:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000008', 1, '08:00', '17:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000008', 1, '08:00', '17:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000008', 2, '08:00', '17:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000008', 2, '08:00', '17:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000008', 3, '08:00', '17:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000008', 3, '08:00', '17:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000008', 4, '08:00', '17:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000008', 4, '08:00', '17:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000008', 5, '08:00', '17:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000008', 5, '08:00', '17:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000008', 6, '09:00', '14:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000008', 6, '09:00', '14:00', 30, 'video');

-- Dr. Campbell (Edinburgh) — 9-17 in-person, 9-17 video, 30min slots, 7 days
INSERT INTO public.availability_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, consultation_type) VALUES
  ('e0000000-0000-0000-0000-000000000009', 0, '10:00', '15:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000009', 0, '10:00', '15:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000009', 1, '09:00', '17:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000009', 1, '09:00', '17:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000009', 2, '09:00', '17:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000009', 2, '09:00', '17:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000009', 3, '09:00', '17:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000009', 3, '09:00', '17:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000009', 4, '09:00', '17:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000009', 4, '09:00', '17:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000009', 5, '09:00', '17:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000009', 5, '09:00', '17:00', 30, 'video'),
  ('e0000000-0000-0000-0000-000000000009', 6, '10:00', '14:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-000000000009', 6, '10:00', '14:00', 30, 'video');

-- Dr. Wright (London) — 8-19 in-person, 8-19 video, 30min slots, 7 days
INSERT INTO public.availability_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, consultation_type) VALUES
  ('e0000000-0000-0000-0000-00000000000a', 0, '10:00', '16:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000a', 0, '10:00', '16:00', 30, 'video'),
  ('e0000000-0000-0000-0000-00000000000a', 1, '08:00', '19:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000a', 1, '08:00', '19:00', 30, 'video'),
  ('e0000000-0000-0000-0000-00000000000a', 2, '08:00', '19:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000a', 2, '08:00', '19:00', 30, 'video'),
  ('e0000000-0000-0000-0000-00000000000a', 3, '08:00', '19:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000a', 3, '08:00', '19:00', 30, 'video'),
  ('e0000000-0000-0000-0000-00000000000a', 4, '08:00', '19:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000a', 4, '08:00', '19:00', 30, 'video'),
  ('e0000000-0000-0000-0000-00000000000a', 5, '08:00', '19:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000a', 5, '08:00', '19:00', 30, 'video'),
  ('e0000000-0000-0000-0000-00000000000a', 6, '09:00', '15:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000a', 6, '09:00', '15:00', 30, 'video');

-- Dr. Sharma (Leeds) — 8-18 in-person, 8-18 video, 30min slots, 7 days
INSERT INTO public.availability_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, consultation_type) VALUES
  ('e0000000-0000-0000-0000-00000000000b', 0, '10:00', '16:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000b', 0, '10:00', '16:00', 30, 'video'),
  ('e0000000-0000-0000-0000-00000000000b', 1, '08:00', '18:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000b', 1, '08:00', '18:00', 30, 'video'),
  ('e0000000-0000-0000-0000-00000000000b', 2, '08:00', '18:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000b', 2, '08:00', '18:00', 30, 'video'),
  ('e0000000-0000-0000-0000-00000000000b', 3, '08:00', '18:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000b', 3, '08:00', '18:00', 30, 'video'),
  ('e0000000-0000-0000-0000-00000000000b', 4, '08:00', '18:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000b', 4, '08:00', '18:00', 30, 'video'),
  ('e0000000-0000-0000-0000-00000000000b', 5, '08:00', '18:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000b', 5, '08:00', '18:00', 30, 'video'),
  ('e0000000-0000-0000-0000-00000000000b', 6, '09:00', '14:00', 30, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000b', 6, '09:00', '14:00', 30, 'video');

-- Dr. Evans (Bristol) — 9-18 in-person, 9-18 video, 50min therapy slots, 7 days
INSERT INTO public.availability_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, consultation_type) VALUES
  ('e0000000-0000-0000-0000-00000000000c', 0, '10:00', '16:00', 50, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000c', 0, '10:00', '16:00', 50, 'video'),
  ('e0000000-0000-0000-0000-00000000000c', 1, '09:00', '18:00', 50, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000c', 1, '09:00', '18:00', 50, 'video'),
  ('e0000000-0000-0000-0000-00000000000c', 2, '09:00', '18:00', 50, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000c', 2, '09:00', '18:00', 50, 'video'),
  ('e0000000-0000-0000-0000-00000000000c', 3, '09:00', '18:00', 50, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000c', 3, '09:00', '18:00', 50, 'video'),
  ('e0000000-0000-0000-0000-00000000000c', 4, '09:00', '18:00', 50, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000c', 4, '09:00', '18:00', 50, 'video'),
  ('e0000000-0000-0000-0000-00000000000c', 5, '09:00', '18:00', 50, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000c', 5, '09:00', '18:00', 50, 'video'),
  ('e0000000-0000-0000-0000-00000000000c', 6, '10:00', '15:00', 50, 'in_person'),
  ('e0000000-0000-0000-0000-00000000000c', 6, '10:00', '15:00', 50, 'video');

-- Also expand Dr. Thompson (existing UK GP) to 7-day availability for testing
DELETE FROM public.availability_schedules WHERE doctor_id = 'e0000000-0000-0000-0000-000000000003';
INSERT INTO public.availability_schedules (doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, consultation_type) VALUES
  ('e0000000-0000-0000-0000-000000000003', 0, '10:00', '16:00', 20, 'in_person'),
  ('e0000000-0000-0000-0000-000000000003', 0, '10:00', '16:00', 20, 'video'),
  ('e0000000-0000-0000-0000-000000000003', 1, '08:00', '18:00', 20, 'in_person'),
  ('e0000000-0000-0000-0000-000000000003', 1, '08:00', '18:00', 20, 'video'),
  ('e0000000-0000-0000-0000-000000000003', 2, '08:00', '18:00', 20, 'in_person'),
  ('e0000000-0000-0000-0000-000000000003', 2, '08:00', '18:00', 20, 'video'),
  ('e0000000-0000-0000-0000-000000000003', 3, '08:00', '18:00', 20, 'in_person'),
  ('e0000000-0000-0000-0000-000000000003', 3, '08:00', '18:00', 20, 'video'),
  ('e0000000-0000-0000-0000-000000000003', 4, '08:00', '18:00', 20, 'in_person'),
  ('e0000000-0000-0000-0000-000000000003', 4, '08:00', '18:00', 20, 'video'),
  ('e0000000-0000-0000-0000-000000000003', 5, '08:00', '18:00', 20, 'in_person'),
  ('e0000000-0000-0000-0000-000000000003', 5, '08:00', '18:00', 20, 'video'),
  ('e0000000-0000-0000-0000-000000000003', 6, '10:00', '15:00', 20, 'in_person'),
  ('e0000000-0000-0000-0000-000000000003', 6, '10:00', '15:00', 20, 'video');

-- Update booking counts for new doctors
UPDATE public.doctors SET total_bookings = (
  SELECT COUNT(*) FROM public.bookings b
  WHERE b.doctor_id = doctors.id AND b.status IN ('completed', 'confirmed', 'approved')
) WHERE id IN (
  'e0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000008',
  'e0000000-0000-0000-0000-000000000009', 'e0000000-0000-0000-0000-00000000000a',
  'e0000000-0000-0000-0000-00000000000b', 'e0000000-0000-0000-0000-00000000000c'
);

-- ============================================================================
-- CLINIC COORDINATES (precise lat/lng for map pins)
-- Requires migration 00028_doctor_clinic_coordinates.sql
-- ============================================================================
UPDATE public.doctors SET clinic_latitude = 52.52462400, clinic_longitude = 13.37821200 WHERE slug = 'dr-hans-mueller';        -- Charitéplatz 1, Berlin
UPDATE public.doctors SET clinic_latitude = 40.98071500, clinic_longitude = 29.06389800 WHERE slug = 'dr-ayse-yilmaz';        -- Bağdat Caddesi, Kadıköy, Istanbul
UPDATE public.doctors SET clinic_latitude = 51.51878900, clinic_longitude = -0.14842100 WHERE slug = 'dr-james-thompson';     -- 25 Harley St, London
UPDATE public.doctors SET clinic_latitude = 48.86885200, clinic_longitude = 2.33069400 WHERE slug = 'dr-marie-dubois';        -- 15 Rue de la Paix, Paris
UPDATE public.doctors SET clinic_latitude = 52.36361100, clinic_longitude = 4.88758500 WHERE slug = 'dr-lisa-van-berg';       -- Keizersgracht 452, Amsterdam
UPDATE public.doctors SET clinic_latitude = 48.22007600, clinic_longitude = 16.35001400 WHERE slug = 'dr-kenji-tanaka';       -- Währinger Gürtel 18-20, Vienna
UPDATE public.doctors SET clinic_latitude = 53.48008300, clinic_longitude = -2.24172300 WHERE slug = 'dr-rachel-patel';       -- 82 King St, Manchester
UPDATE public.doctors SET clinic_latitude = 52.46461800, clinic_longitude = -1.92165900 WHERE slug = 'dr-william-hughes';     -- 42 Harborne Rd, Birmingham
UPDATE public.doctors SET clinic_latitude = 55.94449800, clinic_longitude = -3.19183600 WHERE slug = 'dr-fiona-campbell';     -- 1 Lauriston Place, Edinburgh
UPDATE public.doctors SET clinic_latitude = 51.51924600, clinic_longitude = -0.14865200 WHERE slug = 'dr-oliver-wright';      -- 58 Wimpole St, London
UPDATE public.doctors SET clinic_latitude = 53.80082400, clinic_longitude = -1.54909100 WHERE slug = 'dr-priya-sharma';       -- 14 Park Square East, Leeds
UPDATE public.doctors SET clinic_latitude = 51.45557900, clinic_longitude = -2.60411200 WHERE slug = 'dr-david-evans';        -- 29 Queens Rd, Bristol

-- Re-enable the booking number trigger
ALTER TABLE public.bookings ENABLE TRIGGER trg_generate_booking_number;

-- ============================================================================
-- SUMMARY:
-- 27 locations | 24 specialties | 5 platform settings
-- 3 patients:  sarah.johnson@example.com, michael.chen@example.com, emma.wilson@example.com
-- 12 doctors:  hans.mueller@, ayse.yilmaz@, james.thompson@, marie.dubois@, lisa.vanberg@, kenji.tanaka@
--              rachel.patel@, william.hughes@, fiona.campbell@, oliver.wright@, priya.sharma@, david.evans@
-- All passwords: Password123!
-- 11 bookings (8 completed, 3 upcoming) | 8 reviews | 6 favorites
-- Full 7-day availability for all UK doctors (in_person + video) for testing
-- UK doctors: London(2), Manchester(1), Birmingham(1), Edinburgh(1), Leeds(1), Bristol(1)
-- ============================================================================
