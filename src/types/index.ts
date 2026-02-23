export type UserRole = "patient" | "doctor" | "admin";

export type VerificationStatus =
  | "pending"
  | "under_review"
  | "verified"
  | "rejected"
  | "suspended";

export interface Profile {
  id: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  preferred_locale: string;
  preferred_currency: string;
  created_at: string;
  updated_at: string;
}

export interface Doctor {
  id: string;
  profile_id: string;
  slug: string;
  title: string | null;
  bio: string | null;
  years_of_experience: number | null;
  education: Education[];
  certifications: Certification[];
  languages: string[];
  consultation_types: string[];
  location_id: string | null;
  address: string | null;
  clinic_name: string | null;
  base_currency: string;
  consultation_fee_cents: number;
  video_consultation_fee_cents: number | null;
  stripe_account_id: string | null;
  stripe_onboarding_complete: boolean;
  stripe_payouts_enabled: boolean;
  verification_status: VerificationStatus;
  verified_at: string | null;
  is_featured: boolean;
  featured_until: string | null;
  is_active: boolean;
  cancellation_policy: string;
  cancellation_hours: number;
  avg_rating: number;
  total_reviews: number;
  total_bookings: number;
  meta_title: string | null;
  meta_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Education {
  degree: string;
  institution: string;
  year: number;
}

export interface Certification {
  name: string;
  issuer: string;
  year: number;
}

export interface Specialty {
  id: string;
  name_key: string;
  slug: string;
  icon: string | null;
  display_order: number;
  is_active: boolean;
}

export interface Location {
  id: string;
  country_code: string;
  city: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  is_active: boolean;
}

export interface Booking {
  id: string;
  booking_number: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  consultation_type: string;
  video_room_url: string | null;
  status: string;
  currency: string;
  consultation_fee_cents: number;
  platform_fee_cents: number;
  total_amount_cents: number;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  patient_notes: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  booking_id: string;
  patient_id: string;
  doctor_id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  doctor_response: string | null;
  doctor_responded_at: string | null;
  is_visible: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface AvailableSlot {
  slot_start: string;
  slot_end: string;
  is_available: boolean;
}

export interface DoctorWithRelations extends Doctor {
  profile: Profile;
  location: Location | null;
  specialties: { specialty: Specialty; is_primary: boolean }[];
  photos: DoctorPhoto[];
}

export interface DoctorPhoto {
  id: string;
  doctor_id: string;
  storage_path: string;
  alt_text: string | null;
  display_order: number;
  is_primary: boolean;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read: boolean;
  channel: string;
  created_at: string;
}

export interface SearchParams {
  specialty?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  language?: string;
  consultationType?: string;
  query?: string;
  sort?: string;
  page?: number;
}
