# GTM launch scorecard — 2026-09-14

**Verdict: no-go** for lifting the patient coming-soon gate.

Doctor soft-launch on production TLDs works (`/login`, `/register-doctor`, `/pricing`, `/doctor-dashboard`). The patient marketplace, book wizard, confirmation, and `/dashboard` are correctly walled. Do not open them until the P0 money and security items below ship.

**Tree:** local `main` + uncommitted WIP, **1 commit behind `origin/main`**. Latest merge: `295c4b6` (#17 auth/cron/signup/webhook).  
**Tests this run:** 162 passed (`vitest` on auth/admin/cron/http/license/stripe/booking/founding/password).  
**Live smoke (2026-09-14):** `www.mydoctors360.eu` — `/en/dashboard`, `/en/doctors`, `/en/booking-confirmation` → coming-soon HTML; `/en/login`, `/en/register-doctor`, `/en/pricing`, `/en/doctor-dashboard` → app. Preview `mydoctors360-app.vercel.app/en` also matched `/coming-soon/index.html` (`x-matched-path`).

## Workstreams

| Area | Status | Blockers | Notes |
|------|--------|----------|-------|
| Code (WIP) | Partial | Webhook claim still released after money writes (P1) | P0 Connect/wallet/book-page wiring is in this tree |
| GTM | Blocker | Gate still up (intentional) | Founding book page fixed in code. Do not lift `vercel.json` + middleware + sitemap independently |
| Security | Partial | MFA on actions, `doctorIntent`, rate-limit fail-open (P1) | P0: signup cannot mint admin; token RLS dropped (apply 00109) |
| Sign-up | Partial | Testing-service billed in UI, free in code; doctor terms implied | Doctor wizard + env Price IDs work; patient OAuth + terms gate work |
| MD360 Stripe | Partial | Async `payment_status`, invoice wallet debit, API version pin (P1) | P0 wallet double-pay, wallet-only payout, Connect ready, care-plan `booking_id` done |
| Design | Partial | Coming-soon vs app look like two brands; doctor/patient chrome English-only | Conversion UI (booking/auth) uses `primary` tokens |
| Client portal | Partial | Built, but `/dashboard` + `/booking-confirmation` gated on prod | GDPR export/delete and 30-min idle exist |

## P0 implementation (2026-09-14)

Shipped in this tree (not the coming-soon lift):

| ID | Status | Where |
|----|--------|-------|
| A Founding book page | Done | `bookPageAllowsOnlineBookings` + `doctors/[slug]/book/page.tsx` |
| B Connect complete | Done | `connectAccountIsReady` on `account.updated` |
| C Admin signup + RLS | Done | `00109_gtm_p0_signup_rls.sql` + token pages use service role |
| D Wallet money | Done | No card refund on wallet destination; wallet-only transfers doctor net |
| E Care-plan + deauthorize | Done | `booking_id` metadata + `event.account` |
| F Gate lift | **Not done** (as requested) | |

Apply `supabase/migrations/00109_gtm_p0_signup_rls.sql` on the live database before relying on C.

## P0 — remaining before patient gate lift

1. **Ops, not code:** Production `STRIPE_SECRET_KEY` / Price IDs / webhook secret / Connect must be the **same live MyDoctors360 account**. Set `LEGAL_ENTITY_NAME` (and UK company/ICO) so legal pages are not “pending registration”. One test-mode destination charge + one refund before any gate lift.
2. **Apply `00109_gtm_p0_signup_rls.sql`** on Neon/Supabase. Code is not enough for C.
3. **Coming-soon gate** still up on purpose. Do not lift until (1) and (2) plus a coordinated `vercel.json` + middleware + sitemap change.

**Gate lift is a single deploy:** empty/remove `COMING_SOON_HOSTS` in `middleware.ts` **and** `sitemap.ts` **and** the `vercel.json` rewrite together. Also allow `/dashboard`, `/booking-confirmation`, `/treatment-plan`, `/doctors` in the same change. Partial lift = paid patients land on coming-soon.

## P1 — first week of traffic

- Fulfil `checkout.session.completed` only when `payment_status === "paid"`; handle async payment events.
- Do not delete the webhook idempotency row after wallet/fee side effects (retry double-credit).
- Invoice + Stripe remaining charge never `debitWallet`.
- Clinic reschedule balance PI is a platform-only charge (no destination / application fee).
- Pin Stripe API version so licence `integration_identifier` is valid (field needs 2026-03-25+; SDK default is older).
- Schedule `license-enforcement` in `vercel.json` crons.
- Doctor welcome email is the patient “browse doctors” template (`href="#"`).
- Testing-service register shows £99/mo and never Checkouts or inserts a licence.
- Lock `doctorIntent` OAuth so a crafted server-action call cannot bootstrap doctor/org.
- MFA AAL2 is page-middleware only; server actions use `getUser()` alone.
- Require explicit `accepted` on doctor/testing register (patient already has a checkbox).
- i18n: register-doctor stepper, onboarding, patient dashboard, sidebar labels.
- Confirmation page Doctor/Date/Time rows still English.
- Guest confirmation copy says forgot-password; email is magic-link first.
- Dead `STRIPE_CONNECT_CLIENT_ID` in `.env.example` (Account Links only).

## P2 — backlog

- Accounts v2 (`/v2/core/accounts`) — Express destination charges are the implemented GTM path.
- 15% `application_fee_amount` is **gross of Stripe processing** (platform net is thinner). Do not change the take rate without a pricing decision.
- Embedded Connect `notification_banner` / `account_onboarding`.
- `createSubscriptionCheckout` dead export; `clinic_owner_role` sessionStorage unused.
- Patient `?ref=` ignored; doctor `?ref=` works.
- Coming-soon Inter/`#3b82f6` vs in-app Geist/sky primary; stale `public/colour-preview.html`.
- Prescriptions routes exist, nav hidden — keep hidden for GTM.
- `license-enforcement` / invoice-status / review-summary crons not scheduled.
- Header CLS (`h-14` placeholder vs `h-16`); tap targets on hamburger and guest terms checkbox.

## Explicitly out of scope (this scorecard)

- Lifting coming-soon without the P0 list.
- Building a new client portal (patient `/dashboard` already exists).
- Changing the 15% take rate.
- Accounts v2 migration.
- Pixel-perfect redesign.

## July 2026 docs — do not re-open

Shipped: wizard field fidelity (H1), referral attribute + reward (H2–H3), env Price IDs (H4), webhook seats (H5), resume Checkout (H6 partial — works after they reach Billing), free listing vs paid booking **in the action** (H7), guest checkout, wizard step i18n, guest magic-link claim, OAuth terms interstitial, doctor welcome **send** (wrong template).

## Suggested next PRs (only if you pick them)

| PR | Intent |
|----|--------|
| A | Founding book page uses `doctorCanAcceptOnlineBookings` |
| B | Connect complete = charges + payouts; resume Account Link |
| C | Signup cannot create `role=admin`; fix treatment-plan / invitation RLS |
| D | Wallet refund + wallet-only payout behaviour |
| E | Care-plan webhook metadata; deauthorized account id |
| F | Gate-lift runbook — no rewrite removal until A–E + live Stripe smoke |
