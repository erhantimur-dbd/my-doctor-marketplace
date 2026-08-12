# Product analytics (PostHog)

Scaffold for MD360 product analytics. **Do not confuse with doctor “Analytics” dashboard features.**

## Gates

1. `NEXT_PUBLIC_POSTHOG_KEY` must be set (and not a placeholder).
2. User must accept **analytics** cookies (`cookie_consent.analytics`).

If either gate fails, `track()` is a no-op.

## Privacy

- Session replay: **OFF** (`disable_session_recording: true`)
- Autocapture: **OFF**
- No PII (email/name/phone) and no clinical fields in event props
- `track()` drops property keys matching obvious PII/clinical patterns

## GA4

`AnalyticsScripts` / `NEXT_PUBLIC_GA4_MEASUREMENT_ID` stays the **marketing** measurement path. Do not add these product funnel events to `gtag`.

## v1 events

See `events.ts` (`founding_cta_click`, `doctor_register_started`, …).

## Status

Local scaffold branch — push/PR only after soft-fail #15 merges (Jim sequencing). Keys from Giorgia.
