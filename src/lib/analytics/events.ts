/**
 * Giorgia v1 product analytics events (PostHog).
 *
 * Rules (MD360 / CQC-safe):
 * - No PII (email, name, phone, address)
 * - No clinical content (symptoms, diagnoses, prescriptions, care plans)
 * - Prefer coarse enums (tier, locale, surface, stripe_price_id)
 * - Do not dual-fire these to GA4/gtag (marketing only)
 */

export const AnalyticsEvent = {
  WaitlistSubmit: "waitlist_submit",
  FoundingClaimStarted: "founding_claim_started",
  FoundingClaimSucceeded: "founding_claim_succeeded",
  RegisterStarted: "register_started",
  RegisterCompleted: "register_completed",
  VerificationStatusChanged: "verification_status_changed",
  CheckoutStarted: "checkout_started",
  CheckoutCompleted: "checkout_completed",
  BookingCompleted: "booking_completed",
  /** Soft marketing beacon — optional client-only */
  PricingViewed: "pricing_viewed",
} as const;

export type AnalyticsEventName =
  (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

/** Allowed property value types — keep payloads small and non-identifying. */
export type AnalyticsProps = Record<
  string,
  string | number | boolean | null | undefined
>;

export type AnalyticsContext = {
  locale?: string;
  surface?: "coming_soon" | "marketing" | "app" | "admin" | "server";
  tier?: string;
  founding?: boolean;
  billing_period?: "monthly" | "annual";
  stripe_price_id?: string;
  verification_status?: string;
  previous_status?: string;
};
