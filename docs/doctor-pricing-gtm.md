# Doctor & clinic pricing — GTM packaging

**Updated:** 2026-07-23

## Package matrix (include / exclude)

Source of truth for marketing bullets: `src/lib/constants/package-features.ts`  
Enforcement: `src/lib/utils/feature-flags.ts` (`hasFeature`)  
Pricing UI reads `LICENSE_TIERS` which pulls marketing lists from package-features.

| Package | Monthly | Annual (2 mo free) | Includes (summary) | Excludes (summary) |
|---------|---------|--------------------|--------------------|--------------------|
| **Founding** | £99 (first 100 doctors, monthly, cancel anytime; price locked while subscribed) | Not offered | Same Solo Professional features as the old £0 licence: seats (1), bookings, video, payments, dashboard, analytics, CRM, waitlist, priority support | Multi-doctor seats, multi-location, team ops, branding/API. Cancel forfeits £99. Already-granted `tier=free` rows are not rewritten. |
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

Until period end, the **current** paid tier stays fully active. Cancelling the founding plan ends the £99 price and sets `founding_offer_forfeited_at`, so that doctor cannot start £99 again. Other paid cancels do not mint a new £0 licence. An already-granted `tier=free` row can still be reactivated. Re-upgrade to Starter, Professional, or Clinic is self-service Checkout.

Actions: `schedulePlanChange`, `cancelScheduledPlanChange`, `upgradeLicenseTier`, `createLicenseCheckout`.

## Billing

- **Monthly:** list price per month, **no lock-in** (month-to-month).  
- **Annual:** 12-month term; charge `10 × monthly` once per year (2 months free). Display effective monthly in whole pounds. Downgrade/cancel at annual period end.  
- Stripe: `getOrCreateLicensePriceId(tier, config, "monthly" | "annual")`.  
- Optional env: `STRIPE_PRICE_*_ANNUAL`.  

## Implementation notes

- License checkout: env `STRIPE_PRICE_*` for monthly; annual prices created/searched with metadata `billing_period=annual`.
- Founding plan: `STRIPE_PRICE_FOUNDING` — a Dashboard Price ID for £99/month in the same Stripe mode as `STRIPE_SECRET_KEY`. Monthly only. Do not commit a live `price_…` id. Cancel sets `doctors.founding_offer_forfeited_at` and does not grant another £99 subscription. A successful `claim_founding_member` (spots 1–100) is required before the licence is written.  
- Testing addon: `STRIPE_PRICE_TESTING_ADDON` + metadata `has_testing_addon=1`.  
- Consistency tests: `package-features.test.ts`, `billing-period.test.ts`, `tier-lifecycle.test.ts`.

## Marketing surfaces

- `/en/pricing` — toggle + include/exclude rows from `PACKAGE_MARKETING`  
- Register-doctor plan step + org billing  
- Coming-soon FAQ + this doc for ops  
