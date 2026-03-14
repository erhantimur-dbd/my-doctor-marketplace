"use client";

import { useState, useEffect } from "react";
import Script from "next/script";

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
const CONSENT_KEY = "cookie_consent";

/**
 * Renders GA4 scripts only when the user has given analytics consent.
 * Listens for the "cookie-consent-updated" custom event so it can
 * activate immediately after the user accepts (no page reload needed).
 */
export function AnalyticsScripts() {
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);

  useEffect(() => {
    // Check existing consent on mount
    try {
      const stored = localStorage.getItem(CONSENT_KEY);
      if (stored) {
        const consent = JSON.parse(stored);
        if (consent.analytics) {
          setAnalyticsAllowed(true);
        }
      }
    } catch {
      // No consent or invalid JSON — don't load analytics
    }

    // Listen for consent updates
    function handleConsentUpdate(e: Event) {
      const detail = (e as CustomEvent).detail;
      setAnalyticsAllowed(!!detail?.analytics);
    }

    window.addEventListener("cookie-consent-updated", handleConsentUpdate);
    return () =>
      window.removeEventListener("cookie-consent-updated", handleConsentUpdate);
  }, []);

  if (!analyticsAllowed || !GA_MEASUREMENT_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-config" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', {
            page_path: window.location.pathname,
            anonymize_ip: true,
          });
        `}
      </Script>
    </>
  );
}
