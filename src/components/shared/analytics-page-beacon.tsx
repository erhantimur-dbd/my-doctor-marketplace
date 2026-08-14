"use client";

import { useEffect, useRef } from "react";
import { useLocale } from "next-intl";
import { track } from "@/lib/analytics";
import type { AnalyticsEventName } from "@/lib/analytics";

type Props = {
  event: AnalyticsEventName;
  /** Extra non-PII props */
  props?: Record<string, string | number | boolean | null | undefined>;
};

/**
 * Fires a single product-analytics event on mount (StrictMode-safe).
 * No-ops without PostHog env + analytics consent.
 */
export function AnalyticsPageBeacon({ event, props }: Props) {
  const locale = useLocale();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void track(event, { locale, ...props });
  }, [event, locale, props]);

  return null;
}
