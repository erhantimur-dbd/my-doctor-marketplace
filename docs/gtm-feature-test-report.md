# GTM Feature Test Report

**Date:** 2026-09-29  
**Commit under test:** `708de6b` (main) + this branch fixes  
**Preview host:** `https://mydoctors360-app.vercel.app`  
**Automated suite:** `npm test` → **76 files / 716 tests passed**

---

## Verdict

| Area | Status | Notes |
|------|--------|-------|
| Search / Find a Doctor | **BLOCKED** | Soft-launch chrome gate hides `/doctors`, `/specialties`, `/find` (coming-soon). Unit search contracts pass. |
| Booking appointments | **PASS (deep-link)** | Softsmoke book URL live; guest + auth wizards covered by contracts. Full live Stripe card E2E still needs ops. |
| In-person vs video | **PASS (code + page)** | Type branching + Daily room finalize tested; `/how-it-works/video` 200. Needs `DAILY_API_KEY` in Vercel for live rooms. |
| Payments / Stripe | **PASS (contracts)** | Health shows Stripe OK. Destination-charge + refund + wallet-share unit tests green. Live card E2E open. |
| Cancel / refund / reschedule | **PASS (contracts)** | Consult refund split + Softsmoke email templates tested. Manual Stripe refund drill still recommended. |
| Email notifications | **PASS (infra)** | Health: email OK. Templates + Admin Email Tests harness present. Resend must stay configured in prod. |
| Invoicing | **FIXED → READY** | Create/pay/webhook wired. **Was missing** `invoice-status` cron in `vercel.json` — registered this branch. |
| Patient / doctor feedback | **PASS (contracts)** | Public reviews, NPS cron, Softsmoke post-visit feedback covered. Softsmoke blocks public reviews by design. |
| GDPR | **IMPROVED** | Privacy/cookie/terms 200. Export now includes invoices, wallet, post-visit ratings, NPS (`format_version` 1.1). |
| Doctor signup / pricing | **PASS (smoke)** | `/register-doctor`, `/pricing` 200 on preview. |

**Overall GTM readiness:** Soft-launch doctor funnel is testable. **Patient marketplace GTM is not open** until `SOFT_LAUNCH_HIDE_PATIENT_MARKETPLACE_CHROME` is lifted and a live book → Stripe → email → cron path is signed off on a Connect-complete doctor (not only Softsmoke).

---

## What was executed this session

### A. Automated (local)

```bash
npm test
# 76 files, 716 passed

npx vitest run \
  src/lib/booking/__tests__ \
  src/lib/stripe/__tests__ \
  src/lib/search/__tests__ \
  src/lib/email/__tests__ \
  src/lib/feedback/__tests__ \
  src/lib/reviews/__tests__ \
  # …GTM subset — 34 files / 366 passed
```

Key green contracts: Stripe checkout shape, consult refunds, wallet credit transfers, booking confirmation params, guest booking validators, Softsmoke email templates, NPS, post-visit feedback, soft-launch gates, feature flags.

### B. Preview HTTP smoke (`mydoctors360-app.vercel.app`)

| Path | HTTP | Result |
|------|------|--------|
| `/api/health` | 200 | `database/stripe/email/supabase` all **ok** (`version` 708de6b) |
| `/en` | 200 | Founding coming-soon (expected under soft launch) |
| `/en/doctors` | 200 | Coming-soon (patient marketplace chrome hidden) |
| `/en/doctors/dr-vera-softsmoke-i6jv/book` | 200 | Booking wizard live (deep-link allowlist) |
| `/en/pricing` | 200 | Pricing matrix |
| `/en/register-doctor` | 200 | Founding doctor registration |
| `/en/privacy` | 200 | Privacy policy |
| `/en/terms` | 200 | Terms |
| `/en/cookie-policy` | 200 | Cookie policy |
| `/en/how-it-works/video` | 200 | Video explainer |

### C. Fixes shipped on this branch

1. **Registered missing Vercel crons** (routes existed, never scheduled):
   - `/api/cron/invoice-status` — `0 8 * * *` (overdue → reminders → expire)
   - `/api/cron/license-enforcement` — `0 3 * * *` (past_due → grace → suspended)
   - `/api/cron/generate-review-summaries` — `0 6 * * *` (AI review blurbs)
2. **Synced Admin → System Health** cron list with `vercel.json` (also added previously missing `request-reviews`, `gp-offer-expiry`, `expire-featured`).
3. **Documented `DAILY_API_KEY`** in `.env.example` (already checked on health page).
4. **GDPR export 1.1** — patient portable export now includes invoices, wallet balances/ledger, post-visit feedback ratings, and satisfaction surveys.
5. **Regression tests** for cron registration + GDPR export shape.

---

## Feature-by-feature checklist (ops sign-off)

Use Softsmoke for smoke only. For **payment GTM proof**, use a Connect-complete founding doctor.

### 1. Search
- [ ] Flip `SOFT_LAUNCH_HIDE_PATIENT_MARKETPLACE_CHROME` (or temporary preview override)
- [ ] Specialty / location / price / rating / language / consultation type filters
- [ ] Soonest / nearest / best_match sort
- [ ] Empty state suggestions
- [ ] Map + Google Places (needs Maps key)

### 2. Booking
- [ ] Softsmoke deep-link book (guest)
- [ ] Softsmoke deep-link book (logged-in patient)
- [ ] In-person slot → confirmation (no Daily room)
- [ ] Video slot → confirmation → `video_room_url` present
- [ ] Guest claim email → `/reset-password` works
- [ ] Wallet-only confirmation path (`?booking_id=&wallet=true`)

### 3. Payments / Stripe
- [ ] Stripe test card `4242…` completes Checkout
- [ ] Webhook marks booking confirmed within ~30s
- [ ] Destination charge + application fee visible in Stripe Dashboard
- [ ] Softsmoke Connect bypass **not** used for final GTM proof
- [ ] Licence checkout (Starter/Pro/Clinic) on register-doctor

### 4. Cancel / refund / reschedule
- [ ] Patient cancel inside policy window → partial/full refund
- [ ] Refund to bank vs wallet credit
- [ ] Doctor/admin cancel + refund preview
- [ ] Reschedule request → doctor approve/deny emails
- [ ] Fee-difference reschedule payment (if applicable)

### 5. Email notifications
- [ ] Admin → Email Tests → send all templates to ops inbox
- [ ] Booking confirmation (patient + doctor)
- [ ] Reminder cron (wait or hit `/api/cron/send-reminders` with `CRON_SECRET`)
- [ ] Cancellation / refund / reschedule templates
- [ ] Guest claim + NPS + review request

### 6. Invoicing
- [ ] Doctor creates invoice (Connect complete)
- [ ] Patient pays via Checkout
- [ ] After merge: invoice-status cron marks overdue + sends reminders

### 7. Feedback
- [ ] Complete booking → review request email (non-Softsmoke doctor)
- [ ] Softsmoke → private post-visit platform feedback only
- [ ] NPS survey token page `/survey/[token]`
- [ ] Admin NPS / surveys pages load

### 8. GDPR
- [ ] Cookie banner accept/reject persists
- [ ] Settings → Download my data includes invoices + wallet (v1.1)
- [ ] Delete account blocked while active bookings exist
- [ ] Delete after cancel anonymizes reviews / removes auth user
- [ ] Legal entity env vars complete (`LEGAL_ENTITY_NAME`, registered office, DPO)

---

## Known blockers / do-not-claim

1. **Patient directory search** — gated by soft launch; do not claim live search GTM.
2. **Clinical surfaces** — prescriptions, care plans, public chat/symptoms kill-switched (`src/lib/launch/soft-launch.ts`).
3. **SMS / WhatsApp** — templates exist; Soft Launch marketing marks them Coming — not live.
4. **Softsmoke ≠ production Connect path** — Connect bypass + private feedback diverge from normal doctors.
5. **Live card E2E on production hosts** — still open (Phase A gate / coming-soon on custom domains).
6. **No Playwright suite** — rely on Vitest + this manual checklist.

---

## How to re-run

```bash
# Contracts
npm test

# Preview smoke
BASE=https://mydoctors360-app.vercel.app
curl -sL -o /dev/null -w "%{http_code} %{url_effective}\n" "$BASE/api/health"
curl -sL -A "Mozilla/5.0" -o /dev/null -w "%{http_code}\n" \
  "$BASE/en/doctors/dr-vera-softsmoke-i6jv/book"

# After deploy: confirm new crons appear in Vercel project → Cron Jobs
```

## Sign-off

| Role | Name | Date | Pass? |
|------|------|------|-------|
| Eng (contracts + preview) | Cloud Agent | 2026-09-29 | Partial — see Verdict |
| Ops (live Stripe + email) | | | |
| Founder / GTM | | | |
