/**
 * Cookie-consent helpers for product analytics.
 * Shape matches CookieConsentBanner / AnalyticsScripts.
 */

import { COOKIE_CONSENT_KEY } from "@/lib/analytics/config";

export type CookieConsentState = {
  analytics: boolean;
  marketing: boolean;
  timestamp?: string;
};

export function readCookieConsent(): CookieConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as CookieConsentState;
    return {
      analytics: !!parsed.analytics,
      marketing: !!parsed.marketing,
      timestamp: parsed.timestamp,
    };
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  return readCookieConsent()?.analytics === true;
}
