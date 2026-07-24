# Doctor & clinic pricing — GTM packaging

**Updated:** 2026-07-23

## Package matrix (include / exclude)

Source of truth for marketing bullets: `src/lib/constants/package-features.ts`  
Enforcement: `src/lib/utils/feature-flags.ts` (`hasFeature`)  
Pricing UI reads `LICENSE_TIERS` which pulls marketing lists from package-features.

| Package | Monthly | Annual (2 mo free) | Includes (summary) | Excludes (summary) |
|---------|---------|--------------------|--------------------|--------------------|
| **Founding Free** | £0 | — | Verified public profile, practice profile, dashboard/checklist | Bookings, video, messaging, AI, all reminders, analytics/waitlist/CRM, testing, multi-location |
| **Starter** | £199 | £1,990/yr (~£165.83/mo) | Free + online bookings & Stripe, video, email reminders, messaging, AI; testing **add-on** optional | SMS/WhatsApp, advanced analytics, waitlist, CRM/care plans, multi-location/team, branding/API |
| **Professional** | £299 flat | £2,990/yr | Starter + SMS/WhatsApp, analytics, CRM, care plans, waitlist, priority support; **1 doctor seat** | Multi-doctor seats, multi-location, team ops (Clinic), testing *included* (add-on on Pro), branding/API |
| **Clinic** | £897 (3×£299) | £8,970/yr (~£748/mo) | Pro features + **3 doctor seats** (to 15), multi-location, team tools, **testing included**, clinic dashboard, bulk invoicing, onboarding | Branding, API, SLA (Enterprise) |
| **Enterprise** | Custom | Custom | Clinic + branding, API, 15+ profiles, SLA, dedicated AM | — |
| **Testing add-on** | +£49 | +£490/yr | Diagnostic catalogue on Starter/Pro; **included** on Clinic+ | Not on Free |
| **Extra seat** | +£299 | +£2,990/yr | Clinic only (up to 15 total) | — |

## Free gateway rules

**Worth signing up:** account, org, free license, profile editor, specialties, public listing after admin verification, completion checklist.

**Must upgrade for:** online bookings, Stripe Connect, video, messaging, email+SMS+WhatsApp ops, analytics, care plans, waitlist, **all AI features**.

## Upsell ladder

1. Free → Starter: accept paid bookings, video, AI  
2. Starter → Professional: multi-channel reminders, analytics, waitlist, CRM (still **1 doctor**)  
3. Professional → Clinic: **3–15** seats, multi-location, testing included, practice ops

## Self-service plan changes

| Direction | When features change | Refunds |
|-----------|----------------------|---------|
| **Upgrade** (free→paid, starter→pro, …) | Immediately after Checkout / subscription update | N/A |
| **Downgrade** (pro→starter, paid→free, …) | **End of current paid period** (monthly cycle or **annual term**) | **No pro-rata refunds** |

Until period end, the **current** paid tier stays fully active. After cancel-to-free, webhook restores Founding Free. Re-upgrade is self-service Checkout.

Actions: `schedulePlanChange`, `cancelScheduledPlanChange`, `upgradeLicenseTier`, `createLicenseCheckout`.

## Billing

- **Monthly:** list price per month, 12-month term on paid plans.  
- **Annual:** charge `10 × monthly` once per year (2 months free). Display effective monthly in whole pounds. Downgrade/cancel at annual period end.  
- Stripe: `getOrCreateLicensePriceId(tier, config, "monthly" | "annual")`.  
- Optional env: `STRIPE_PRICE_*_ANNUAL`.  

## Implementation notes

- License checkout: env `STRIPE_PRICE_*` for monthly; annual prices created/searched with metadata `billing_period=annual`.  
- Testing addon: `STRIPE_PRICE_TESTING_ADDON` + metadata `has_testing_addon=1`.  
- Consistency tests: `package-features.test.ts`, `billing-period.test.ts`, `tier-lifecycle.test.ts`.

## Marketing surfaces

- `/en/pricing` — toggle + include/exclude rows from `PACKAGE_MARKETING`  
- Register-doctor plan step + org billing  
- Coming-soon FAQ + this doc for ops  
