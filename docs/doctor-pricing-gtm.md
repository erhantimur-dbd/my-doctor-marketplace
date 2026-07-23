# Doctor & clinic pricing — GTM packaging

**Updated:** 2026-07-23

## Package matrix (include / exclude)

Source of truth for marketing bullets: `src/lib/constants/package-features.ts`  
Enforcement: `src/lib/utils/feature-flags.ts` (`hasFeature`)  
Pricing UI reads `LICENSE_TIERS` which pulls marketing lists from package-features.

| Package | Price | Includes (summary) | Excludes (summary) |
|---------|-------|--------------------|--------------------|
| **Founding Free** | £0 | Verified public profile, practice profile, dashboard/checklist | Online bookings/payments, video, AI insights, email/SMS/WhatsApp reminders, analytics, waitlist, CRM/care plans, multi-location |
| **Starter** | £199/mo | Free + online bookings & Stripe payouts, video, email reminders, messaging, AI review summaries; testing **add-on** optional | SMS/WhatsApp, advanced analytics, waitlist auto-notify, CRM/care plans, multi-location, custom branding |
| **Professional** | £299/user/mo | Starter + 1–4 seats, SMS/WhatsApp, analytics, CRM, care plans & prescriptions, waitlist auto-notify, priority support | Multi-location/team (5+), medical testing included (use add-on), custom branding, API |
| **Clinic** | £1,495/mo | Pro + 5 seats (to 15), multi-location, team tools, **testing included**, clinic dashboard, bulk invoicing, onboarding | Custom branding, API, SLA (Enterprise) |
| **Enterprise** | Custom | Clinic + branding, API, 15+ profiles, SLA, dedicated AM | — |
| **Testing add-on** | +£49/mo | Diagnostic catalogue on Starter/Pro (line item); included on Clinic+ | Not on Free |
| **Extra seat** | +£299/mo | Pro/Clinic seat expansion | — |

## Free gateway rules

**Worth signing up:** account, org, free license, profile editor, specialties, public listing after admin verification, completion checklist.

**Must upgrade for:** online bookings, Stripe Connect, video, email+SMS+WhatsApp ops, analytics, care plans, waitlist, **all AI features**.

## Upsell ladder

1. Free → Starter: accept paid bookings, video, AI  
2. Starter → Professional: multi-channel reminders, analytics, waitlist, CRM  
3. Professional → Clinic: seats, multi-location, testing included  

## Implementation notes

- License checkout: `getOrCreateLicensePriceId` (env `STRIPE_PRICE_*`).
- Testing addon: `STRIPE_PRICE_TESTING_ADDON` + metadata `has_testing_addon=1`.
- Monthly is sold cadence; consistency tests: `package-features.test.ts`.

## Marketing surfaces

- `/en/pricing` — all packages show include + exclude rows  
- Coming-soon + register-doctor free notice  
- This doc for ops  
