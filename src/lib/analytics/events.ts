/**
 * v1 product analytics events.
 *
 * Rules (MD360 / CQC-safe):
 * - No PII (email, name, phone, address)
 * - No clinical content (symptoms, diagnoses, prescriptions, care plans)
 * - Prefer coarse enums (tier, locale, surface)
 * - GA4/gtag must NOT receive these — marketing surface only
 */

export const AnalyticsEvent = {
  /** Soft-launch founding CTA on coming-soon or marketing */
  FoundingCtaClick: "founding_cta_click",
  /** Doctor registration form opened / started */
  DoctorRegisterStarted: "doctor_register_started",
  /** Doctor account created (free or before checkout) — no identifiers */
  DoctorRegisterCompleted: "doctor_register_completed",
  /** Pricing page viewed */
  PricingViewed: "pricing_viewed",
  /** Paid checkout session creation attempted */
  CheckoutStarted: "checkout_started",
  /** Checkout returned success query (client-side) */
  CheckoutSucceeded: "checkout_succeeded",
  /** Doctor waitlist form submitted from coming-soon (secondary CTA) */
  DoctorWaitlistSubmitted: "doctor_waitlist_submitted",
} as const;

export type AnalyticsEventName =
  (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

/** Allowed property value types — keep payloads small and non-identifying. */
export type AnalyticsProps = Record<
  string,
  string | number | boolean | null | undefined
>;

/** Shared optional context — never put email/user id here. */
export type AnalyticsContext = {
  locale?: string;
  surface?: "coming_soon" | "marketing" | "app" | "admin";
  tier?: string;
  founding?: boolean;
  billing_period?: "monthly" | "annual";
};
