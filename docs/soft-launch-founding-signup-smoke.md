# Soft Launch founding doctor signup — smoke notes

**Preview Ready** (do not merge / do not promote).  
**Base:** `main` @ `79299f5` (#18 clinical hard-disable + #28 pricing titles).  
**This preview:** Founding Free = lifetime Solo Professional entitlements (non-clinical).

## Paths in play

| Path | Role |
|------|------|
| `/en/register-doctor?tier=free&founding=1` | Primary Founding Free signup (implemented wizard) |
| `/en/register-doctor` | Same wizard; default plan is Founding Free |
| `/en/invite/[token]` | Clinic **seat** invite (joins inviter org; not a Founding Free licence) |
| `/en/register-doctor?ref=` | Referral (independent account + own Founding Free licence) |

WABA / outbound / #19 specialty invite landings were **not** touched.

## Automated contracts

```bash
npx vitest run \
  src/lib/utils/__tests__/feature-flags.test.ts \
  src/lib/constants/__tests__/package-features.test.ts \
  src/lib/constants/__tests__/soft-launch-claims.test.ts \
  src/lib/launch/__tests__/soft-launch.test.ts \
  src/lib/founding/__tests__/members.test.ts \
  src/lib/license/__tests__/tier-lifecycle.test.ts \
  src/lib/auth/__tests__/doctor-signup-flow.test.ts \
  src/lib/auth/__tests__/doctor-signup-fields.test.ts
```

## Manual smoke (Preview host)

Replace `BASE` with the Vercel Preview URL for this branch (or `https://www.mydoctors360.co.uk` only if Product asks for a production read-only check — do not promote).

| # | URL | Expected | Result |
|---|-----|----------|--------|
| S1 | `{BASE}/en/register-doctor?tier=free&founding=1` | App wizard (not coming-soon). Title: Join the Founding Doctor Programme. On-form under H1 (before the form): quiet chrome **lifetime Founding Free · Solo Professional · value £299/mo**. Founding Free pre-selected. Plan step: lifetime Professional equivalent · £299/mo · £0. No “free forever”. | _pending Preview_ |
| S2 | `{BASE}/en/register-doctor` | Same wizard; plan step includes Founding Free £0. | _pending Preview_ |
| S3 | `{BASE}/en/pricing` | Founding Free card: £0, lifetime Professional equivalent, value £299/mo. Footer: SMS/WhatsApp Coming. No care-marketplace title. | _pending Preview_ |
| S4 | `{BASE}/en/how-it-works` | Founding FAQ matches lock. Marketplace-not-care-provider disclaimer present. | _pending Preview_ |
| S5 | `{BASE}/coming-soon/index.html` | Claim CTA → register-doctor `tier=free&founding=1`. Fine print: lifetime Pro / £299 / £0. | _pending Preview_ |
| S6 | Register UK doctor (fresh email), GMC 7-digit, city, Founding Free → Create Account | Redirect `/en/verify-email?email=`. | _pending Preview_ |
| S7 | Confirm email → `/en/doctor-dashboard` | Founding banner (if first 100). No “upgrade to unlock bookings”. Checklist includes Connect Stripe. | _pending Preview_ |
| S8 | Admin / DB | `doctors.is_founding_member=true` (if spots remain). `licenses.tier=free`, `status=active`, `max_seats=1`, `current_period_end` far-future, metadata `entitlement_tier=professional`, `perk=lifetime`, `claim_value_gbp_monthly=299`. | _pending Preview_ |
| S9 | Feature flags (eng) | `hasFeature` on that free licence equals Professional for bookings/video/stripe/analytics/CRM/waitlist. `multi_location` false. | _pending Preview_ |
| S10 | Clinical negative | `/en/doctor-dashboard/prescriptions` and `/treatment-plans` unavailable. `POST /api/chat` 403. No upgrade/unlock copy. | _pending Preview_ |
| S11 | Invite path | `/en/invite/[token]` (Clinic seat) still resolves; does not rewrite Founding Free onto the Clinic org. | _pending Preview_ |

## Local / contract smoke (this agent)

Recorded 2026-09-17 on `cursor/founding-free-lifetime-pro-84ad` (`npm test` — **462 passed / 51 files**). Preview host rows above stay pending until Vercel Preview is stamped.

| Check | Result | Notes |
|-------|--------|-------|
| Entitlement unit tests (`hasFeature("free") === professional`) | **PASS** | Missing licence still denies. `getFeaturesForTier("free")` equals Professional. `multi_location` false. |
| Soft Launch #18 kill-switch tests | **PASS** | Rx / care / chat / STT-TTS remain `false` even though Founding Free has Pro flags |
| Soft Launch claims (no live SMS/WhatsApp, no care marketplace title) | **PASS** | Coming footer still required on pricing chrome |
| Founding signup structural contracts (wizard + `registerDoctor` + `founding=1` + lifetime metadata) | **PASS** | Invite path unchanged |

## Pass criteria

- S1–S5 HTML/copy green on Preview
- S6–S8 account + licence row prove Founding Free lifetime Professional metadata
- S9 Professional non-clinical flags on; Clinic seats not granted
- S10 #18 still fail-closed
- S11 invite path not broken

**Overall:** Soft Launch Preview Ready for code + contracts (S9 entitlement + #18 kill-switch **PASS** locally). S1–S8 / S11 need Parker/Sandy Preview host stamp. Do not merge. Do not promote.
