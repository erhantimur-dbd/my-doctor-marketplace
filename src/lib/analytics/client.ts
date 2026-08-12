import {
  getPostHogHost,
  getPostHogKey,
  isPostHogConfigured,
  scrubAnalyticsProps,
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
  if (!isPostHogConfigured() || !hasAnalyticsConsent()) return null;
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
          person_profiles: "identified_only",
          capture_pageview: true,
          capture_pageleave: true,
          disable_session_recording: true,
          autocapture: false,
          persistence: "localStorage+cookie",
          respect_dnt: true,
        });
        posthog.__loaded = true;
        client = posthog;
        return posthog;
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[analytics] PostHog init failed:", err);
        }
        return null;
      }
    })();
  }
  return initPromise;
}

export async function enablePostHog(): Promise<void> {
  const ph = await loadClient();
  ph?.opt_in_capturing?.();
}

export async function disablePostHog(): Promise<void> {
  if (!client) return;
  try {
    client.opt_out_capturing();
    client.reset();
  } catch {
    /* ignore */
  }
}

export async function track(
  event: AnalyticsEventName,
  props?: AnalyticsProps
): Promise<void> {
  if (!isPostHogConfigured() || !hasAnalyticsConsent()) return;
  const ph = await loadClient();
  if (!ph) return;
  ph.capture(event, scrubAnalyticsProps(props));
}
