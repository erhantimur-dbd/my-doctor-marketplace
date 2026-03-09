export type UserRole = "patient" | "doctor" | "admin";

// ─── Organization & Licensing Types ─────────────────────────
export type OrgRole = "owner" | "admin" | "doctor" | "staff";

export type LicenseStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "grace_period"
  | "suspended"
  | "cancelled";

export type LicenseTier = "starter" | "professional" | "clinic" | "enterprise";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  timezone: string;
  base_currency: string;
  stripe_customer_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgRole;
  invited_by: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  status: "invited" | "active" | "suspended" | "removed";
  created_at: string;
  updated_at: string;
}

export interface License {
  id: string;
  organization_id: string;
  tier: LicenseTier;
  status: LicenseStatus;
  max_seats: number;
  used_seats: number;
  extra_seat_count: number;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  grace_period_start: string | null;
  suspended_at: string | null;
  trial_ends_at: string | null;
  cancelled_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LicenseModule {
  id: string;
  license_id: string;
  module_key: string;
  is_active: boolean;
  stripe_subscription_item_id: string | null;
  activated_at: string;
  deactivated_at: string | null;
  created_at: string;
}

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
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  preferred_locale: string;
  preferred_currency: string;
  created_at: string;
  updated_at: string;
}

export type ProviderType = "doctor" | "testing_service";

export interface Doctor {
  id: string;
  profile_id: string;
  organization_id: string | null;
  provider_type: ProviderType;
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
  accepted_payments: string[];
  is_wheelchair_accessible: boolean;
  has_testing_addon: boolean;
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
  category: "medical" | "testing";
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

export interface DoctorService {
  id: string;
  doctor_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  duration_minutes: number;
  consultation_type: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface FollowUpInvitation {
  id: string;
  token: string;
  doctor_id: string;
  patient_id: string;
  service_id: string | null;
  service_name: string;
  consultation_type: string;
  duration_minutes: number;
  unit_price_cents: number;
  total_sessions: number;
  discount_type: "percentage" | "fixed_amount" | null;
  discount_value: number | null;
  discounted_total_cents: number;
  platform_fee_cents: number;
  currency: string;
  status: string;
  sessions_booked: number;
  doctor_note: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
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
  service_id: string | null;
  service_name: string | null;
  invitation_id: string | null;
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
