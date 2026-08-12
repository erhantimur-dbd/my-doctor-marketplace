/**
 * PostHog browser client — env + consent gated, session replay OFF.
 *
 * Safe to import from client components only (dynamic import of posthog-js).
 */

import {
  getPostHogHost,
  getPostHogKey,
  isPostHogConfigured,
} from "@/lib/analytics/config";
import { hasAnalyticsConsent } from "@/lib/analytics/consent";
import type {
  AnalyticsEventName,
  AnalyticsProps,
} from "@/lib/analytics/events";

type PostHogClient = {
  init: (key: string, options: Record<string, unknown>) => void;
  capture: (event: string, props?: Record<string, unknown>) => void;
  opt_in_capturing: () => void;
  opt_out_capturing: () => void;
  reset: () => void;
  __loaded?: boolean;
};

let client: PostHogClient | null = null;
let initPromise: Promise<PostHogClient | null> | null = null;

async function loadClient(): Promise<PostHogClient | null> {
  if (typeof window === "undefined") return null;
  if (!isPostHogConfigured()) return null;
  if (!hasAnalyticsConsent()) return null;

  if (client?.__loaded) return client;

  if (!initPromise) {
    initPromise = (async () => {
      const key = getPostHogKey();
      if (!key) return null;

      try {
        const mod = await import("posthog-js");
        const posthog = (mod.default ?? mod) as unknown as PostHogClient;
        posthog.init(key, {
          api_host: getPostHogHost(),
          // Privacy defaults for a health marketplace
          person_profiles: "identified_only",
          capture_pageview: true,
          capture_pageleave: true,
          // Session replay OFF until explicitly approved
          disable_session_recording: true,
          autocapture: false,
          persistence: "localStorage+cookie",
          // Respect Do Not Track
          respect_dnt: true,
        });
        posthog.__loaded = true;
        client = posthog;
        return posthog;
      } catch (err) {
        // Missing package or blocked network — fail quiet in prod
        if (process.env.NODE_ENV === "development") {
          console.warn("[analytics] PostHog init failed:", err);
        }
        return null;
      }
    })();
  }

  return initPromise;
}

/** Start or resume capturing after analytics consent is granted. */
export async function enablePostHog(): Promise<void> {
  const ph = await loadClient();
  ph?.opt_in_capturing?.();
}

/** Stop capturing when analytics consent is revoked. */
export async function disablePostHog(): Promise<void> {
  if (!client) return;
  try {
    client.opt_out_capturing();
    client.reset();
  } catch {
    /* ignore */
  }
}

/**
 * Capture a v1 product event. No-ops without env + analytics consent.
 * Never pass PII or clinical fields in `props`.
 */
export async function track(
  event: AnalyticsEventName,
  props?: AnalyticsProps
): Promise<void> {
  if (!isPostHogConfigured() || !hasAnalyticsConsent()) return;
  const ph = await loadClient();
  if (!ph) return;

  const cleaned: Record<string, unknown> = {};
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined) continue;
      // Belt-and-braces: drop obvious PII keys if someone slips
      if (/email|phone|name|dob|nhs|gmc|symptom|diagnos|prescri/i.test(k)) {
        continue;
      }
      cleaned[k] = v;
    }
  }

  ph.capture(event, cleaned);
}
