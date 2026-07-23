# Doctor sign-up flow audit — MyDoctors360

**Date:** 2026-07-23  
**Scope:** Public entry → account → licence/Stripe → email verify → doctor-dashboard → bookable readiness  
**Kind:** Analysis only (no signup fixes in this goal)

---

## 1. End-to-end path (as implemented)

```
Entry
  /pricing? → /register-doctor?tier=
  /register-doctor?ref= / ?tier= / ?owner_role=
  footer, specialties, coming-soon CTA, auth “for doctors”
       │
       ▼
  /[locale]/register-doctor  (5-step wizard)
       │
       ├─ country ∉ launch regions (GB,IE,IT,TR,ES) @ step≥3
       │     → DoctorWaitlistForm only (no account)
       │
       ├─ free tier
       │     → createDoctorAccount → licenses(free,active)
       │     → redirect /verify-email?email=
       │
       └─ paid tier
             → createDoctorAccount → Stripe Checkout (subscription)
             → success /verify-email?email=&checkout=success
             → webhook customer.subscription.* → licenses upsert
       │
       ▼
  Supabase email confirm → /callback → /email-verified
       → /doctor-dashboard (role doctor)
       │
       ▼
  Post-signup (multi-step, not one-shot):
  profile completion · availability · Stripe Connect
  · admin verification_status=verified
       │
       ▼
  Bookable when: verified + active + org license active/trialing/past_due
                 + Connect onboarding complete + consultation type + slots
```

---

## 2. Stages, entry points, wiring

| Stage | Entry points | Status | Evidence |
|-------|--------------|--------|----------|
| **Public register** | `src/app/[locale]/(public)/register-doctor/page.tsx` — 5 steps: Personal → Professional → Practice → Pricing → Plan | **Wired** | Client wizard; soft-launch allowlisted |
| **Pricing entry** | `pricing/page.tsx` links `?tier=`; clinic CTA `ClinicGetStartedButton` | **Wired** | `?tier=` + `?owner_role=` |
| **Referral `ref`** | URL `?ref=` → validate + form `referral_code` | **Partial** | UI wired; server does not attribute cold `ref` (see risks) |
| **Region waitlist** | Non-launch country @ step ≥3 → `DoctorWaitlistForm` | **Wired** | Capture only, no doctor account |
| **Account create** | `createDoctorAccount` private helper in `src/actions/auth.ts` | **Wired** | `signUp` + profile + doctors + specialties/skills + org |
| **Free register** | `registerDoctor` → free `licenses` row → `redirect` verify-email | **Wired** | `auth.ts` ~618–640 |
| **Paid register** | `registerDoctorWithCheckout` → Checkout `mode: subscription` | **Wired** | Ephemeral `prices.create` (monthly GBP); not env Price IDs |
| **Licence webhook** | `customer.subscription.created/updated` → `licenses` upsert | **Partial** | Seats/metadata incomplete (see risks) |
| **Email verify** | Supabase confirm → `callback` → `email-verified` | **Wired** | Doctor next-steps copy role-aware |
| **Doctor welcome email** | Resend `welcomeEmail` | **Missing** for doctors | Only patient `register()` ~197 |
| **Dashboard land** | `doctor-dashboard/page.tsx`; middleware role guard | **Wired** | No doctor row → re-register; clinic onboarding redirect |
| **Connect** | `connectStripeAccount` in `doctor.ts` | **Wired** | Post-signup, not during register form |
| **Admin verify** | Admin approvals / checklist (UK CQC path) | **Wired** | Required for search listing |
| **Bookable** | `booking.ts` + `search.ts` | **Wired** gates | verified + Connect + license |

### Soft-launch / coming-soon

| Host | `/en/register-doctor`, `/en/pricing`, `/en/doctor-dashboard` |
|------|---------------------------------------------------------------|
| Production `.com` / `.co.uk` / `.eu` | **App** (allowlisted) — smoke 200, not coming-soon |
| Patient home / doctors | Still gated to Founding Doctor page |
| Sync surfaces | `middleware.ts` `COMING_SOON_ALLOWED_PREFIXES`, `vercel.json` rewrite, `sitemap.ts` soft pages |

**Live smoke (2026-07-23):** all of  
`/en/register-doctor`, `?tier=starter`, `?ref=TEST`, `/en/pricing` on `www.mydoctors360.eu` and preview host returned **200 + app title** (not Founding Doctor).

---

## 3. Account creation detail (`createDoctorAccount`)

| Creates | Notes |
|---------|--------|
| `auth.users` | `role: doctor` metadata; rate limit 3/30m IP |
| `profiles` | Trigger poll + upsert fallback |
| `doctors` | slug, fee **0**, referral_code, address, UK fields |
| `doctor_specialties` | From JSON; non-blocking |
| `doctor_skills` | Optional; non-blocking |
| `organizations` + owner membership | Non-blocking if fails |
| Free `licenses` | Only via `registerDoctor` when tier free |
| Colleague invite | Optional emails at signup |

**Not at signup:** education, availability, Stripe Connect, title/years/languages/fees/consultation_types (UI collects some; **not submitted** — see blockers).

---

## 4. Bookable readiness chain

| Requirement | Listing (search) | Booking |
|-------------|------------------|---------|
| `verification_status === verified` | Yes | Yes |
| `is_active` | Yes | Yes |
| Org license active/trialing/past_due (incl. free) | Yes (RPC) | Yes |
| Stripe Connect complete | No | Yes |
| Consultation type on doctor | Soft | Yes |
| Availability slots | Soft | Practical need |

**Implication:** Free-tier doctors with admin verification + Connect can accept bookings even though marketing free tier excludes “Online bookings”.

---

## 5. Prioritised gaps / risks

### Blockers / high (soft-launch acquisition quality)

| # | Issue | Severity | Evidence |
|---|--------|----------|----------|
| H1 | Wizard **discards** title, years, consultation types, languages, fees — server hard-codes fee 0 | **High** | `register-doctor/page.tsx` formData sets omit them; `auth.ts` `consultation_fee_cents: 0` |
| H2 | **`?ref=` cold signup never attributes** — `processReferralSignup` matches invite **email** only | **High** | `referral.ts` 188–202; form still sends `referral_code` |
| H3 | **`processReferralReward` never called** after paid licence | **High** | Defined `referral.ts`; absent from webhook |
| H4 | Paid Checkout uses **ephemeral monthly prices**; env `STRIPE_PRICE_*` unused on register; comments say annual | **High** | `auth.ts` 677–687; `license-tiers.ts` comments |
| H5 | Webhook license upsert **does not set max_seats/used_seats** for multi-seat plans | **High** | `webhooks/stripe/route.ts` ~681–703 |
| H6 | Cancelled paid checkout leaves **account without license** and weak recovery | **Medium-High** | Cancel URL reopens wizard; no “resume checkout” |
| H7 | Free product promise vs enforcement: free license **passes** book/list gates | **Medium-High** | free license insert + booking license check |

### Medium

| # | Issue | Severity | Evidence |
|---|--------|----------|----------|
| M1 | No doctor **welcome** transactional email after create | Medium | `welcomeEmail` only patient register |
| M2 | OAuth buttons on register page **do not** create doctor/org | Medium | OAuth helpers; no doctor bootstrap |
| M3 | GMC 7-digit validation UI for **all** countries | Medium | Wizard professional step |
| M4 | `has_testing_addon` flag only — no Stripe module line | Medium | form + doctors column |
| M5 | Org create failure → free path may lack license; paid errors after partial create | Medium | org non-blocking |
| M6 | `clinic_owner_role` sessionStorage unused | Low-Med | set in page, not auth |

### Polish

| # | Issue |
|---|--------|
| P1 | Profile completion may mis-detect specialties if expecting array on doctor row |
| P2 | Email-verified “browse doctors” hits patient gate on production hosts |
| P3 | `license-enforcement` cron route not scheduled in `vercel.json` |

---

## 6. Follow-up implementation goals (suggested order)

1. **Signup field fidelity** — submit + persist title, years, languages, consultation_types, fees (H1).  
2. **Referral integrity** — resolve `referral_code` to referrer; call reward on licence activation (H2–H3).  
3. **Licence Stripe hygiene** — use env Price IDs; set seats on webhook; resume-checkout for orphans (H4–H6).  
4. **Free-tier product rules** — block booking (or listing) for free if marketing requires it (H7).  
5. **Doctor welcome email** + OAuth doctor bootstrap (M1–M2).  

---

## 7. What works well (do not re-build)

- Soft-launch allowlist for doctor acquisition on production domains.  
- Full multi-step wizard UX + launch-region waitlist.  
- Shared `createDoctorAccount` + free/paid branch.  
- UK regulatory capture at signup for admin checklist.  
- Middleware dashboard protection + Connect + admin verify + booking gates form a coherent path to bookable.

---

## URL smoke (optional evidence)

See `docs/evidence-scratch/doctor-signup-url-smoke.txt` — production register-doctor/pricing serve the **app**, not coming-soon.


## Implementation status (2026-07-23)

H1–H7 shipped in commit after audit (wizard field fidelity, referral code + rewards, env Price IDs, webhook seats, resume checkout, free-tier booking block).
