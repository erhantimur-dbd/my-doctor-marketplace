export const POSTHOG_DEFAULT_HOST = "https://eu.i.posthog.com";
export const COOKIE_CONSENT_KEY = "cookie_consent";
export const COOKIE_CONSENT_EVENT = "cookie-consent-updated";

export function getPostHogKey(): string | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  if (!key) return null;
  if (key === "phc_xxxxxxxx" || key.includes("placeholder")) return null;
  return key;
}

export function getPostHogHost(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || POSTHOG_DEFAULT_HOST;
}

export function isPostHogConfigured(): boolean {
  return getPostHogKey() !== null;
}

export function scrubAnalyticsProps(
  props?: Record<string, string | number | boolean | null | undefined>
): Record<string, string | number | boolean | null> {
  const cleaned: Record<string, string | number | boolean | null> = {};
  if (!props) return cleaned;
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue;
    if (/email|phone|name|dob|nhs|gmc|symptom|diagnos|prescri|patient/i.test(k)) {
      continue;
    }
    cleaned[k] = v;
  }
  return cleaned;
}
