/**
 * Product analytics config (PostHog).
 *
 * Keys are placeholders until Giorgia delivers project credentials.
 * Nothing loads unless BOTH key env is present AND the user granted
 * analytics cookie consent (see consent.ts / PostHogProvider).
 *
 * GA4 stays in AnalyticsScripts for marketing measurement only —
 * do not add product funnel events to gtag.
 */

export const POSTHOG_KEY_ENV = "NEXT_PUBLIC_POSTHOG_KEY";
export const POSTHOG_HOST_ENV = "NEXT_PUBLIC_POSTHOG_HOST";

/** Default EU cloud host — override via NEXT_PUBLIC_POSTHOG_HOST if needed. */
export const POSTHOG_DEFAULT_HOST = "https://eu.i.posthog.com";

export const COOKIE_CONSENT_KEY = "cookie_consent";
export const COOKIE_CONSENT_EVENT = "cookie-consent-updated";

export function getPostHogKey(): string | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  return key && key.length > 0 && key !== "phc_xxxxxxxx" ? key : null;
}

export function getPostHogHost(): string {
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
  return host || POSTHOG_DEFAULT_HOST;
}

/** True when the SDK may be loaded (env present). Consent is checked separately. */
export function isPostHogConfigured(): boolean {
  return getPostHogKey() !== null;
}
