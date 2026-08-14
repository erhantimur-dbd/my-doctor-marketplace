"use client";

import { useEffect } from "react";
import { COOKIE_CONSENT_EVENT, isPostHogConfigured } from "@/lib/analytics/config";
import { hasAnalyticsConsent } from "@/lib/analytics/consent";
import { disablePostHog, enablePostHog } from "@/lib/analytics/client";

/**
 * Boots PostHog only when:
 * 1) NEXT_PUBLIC_POSTHOG_KEY is set (Giorgia keys), and
 * 2) the user has analytics cookie consent.
 *
 * Session replay stays disabled in the client init options.
 * GA4 is separate (AnalyticsScripts) — marketing measurement only.
 */
export function PostHogProvider() {
  useEffect(() => {
    if (!isPostHogConfigured()) return;

    function sync(allowed: boolean) {
      if (allowed) {
        void enablePostHog();
      } else {
        void disablePostHog();
      }
    }

    sync(hasAnalyticsConsent());

    function onConsent(e: Event) {
      const detail = (e as CustomEvent).detail as
        | { analytics?: boolean }
        | undefined;
      sync(!!detail?.analytics);
    }

    window.addEventListener(COOKIE_CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, onConsent);
  }, []);

  return null;
}
