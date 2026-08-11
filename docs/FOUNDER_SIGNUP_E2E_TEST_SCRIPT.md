# Founder Doctor Sign-up — 30-minute E2E test script

**Goal:** Prove the soft-launch doctor funnel is safe for real outreach.  
**Environment:** Production or staging with real Supabase + Stripe test mode.  
**Prereqs:**

- [ ] Migration `00107_founding_members.sql` applied
- [ ] Vercel env: `LEGAL_ENTITY_NAME`, `COMPANIES_HOUSE_NUMBER`, `REGISTERED_OFFICE` set
- [ ] Stripe test keys + price IDs (or on-the-fly prices OK for test)
- [ ] Admin account on `ADMIN_EMAILS` allowlist
- [ ] Deploy includes `fix/founder-signup-go-live` (or equivalent)

**Timebox:** ~30 minutes.

---

## A. Gated landing + waitlist (5 min)

| # | Step | Expected |
|---|------|----------|
| A1 | Open `https://www.mydoctors360.co.uk/` | Founding landing (coming-soon), not patient marketplace |
| A2 | Click **Register as a Doctor** | Lands on `/en/register-doctor` |
| A3 | Click **See free vs paid plans** | Lands on `/en/pricing` with Founding Free £0, Starter £199, Pro £299, Clinic £897 |
| A4 | Submit waitlist form with unique email | Success message; row in Admin → Waitlist (`new`) |
| A5 | Spam submit same form 6+ times quickly | Eventually 429 / “Too many requests” |

---

## B. Free (Founding) registration — UK doctor (10 min)

Use a fresh email, e.g. `founder+free1@yourdomain.com`.

| # | Step | Expected |
|---|------|----------|
| B1 | `/en/register-doctor?tier=free` | Wizard step 1 |
| B2 | Personal info + strong password → Next | Step 2 |
| B3 | Leave GMC blank, pick specialty → Next | Allowed (GMC enforced after country) |
| B4 | Country = United Kingdom, city blank → Next | Error: practice city required |
| B5 | City set, GMC still blank → Next | Error: 7-digit GMC required |
| B6 | GMC `1234567`, complete UK CQC/indemnity blocks → Next | Step 4 pricing |
| B7 | Fees default → Next → Create Account | Redirect verify-email |
| B8 | Confirm email (Supabase link) → login | Doctor dashboard |
| B9 | Check banner “Pending GMC verification” | Visible |
| B10 | Profile completion card | Incomplete items listed |
| B11 | Supabase/admin: doctor row | `is_founding_member=true`, `founding_member_number` 1–100, `is_featured=true` |
| B12 | Free license | `licenses.tier=free`, status active |

---

## C. Paid registration — Starter (monthly) (7 min)

Fresh email `founder+starter1@…`.

| # | Step | Expected |
|---|------|----------|
| C1 | `/en/register-doctor?tier=starter` | Starter pre-selected on step 5 |
| C2 | Complete wizard with GB + GMC + city | Subscribe & Create Account |
| C3 | Stripe Checkout | Amount £199/mo (test mode) |
| C4 | Pay with test card `4242…` | Redirect verify-email `checkout=success` |
| C5 | After webhook (~30s): license | `tier=starter`, status active, stripe_subscription_id set |
| C6 | Cancel path: start again, abandon Checkout | Account exists; can resume from billing |

---

## D. Admin portal (5 min)

| # | Step | Expected |
|---|------|----------|
| D1 | `/en/admin` as allowlisted admin | Dashboard loads (not coming-soon) |
| D2 | Doctors → open free founder from B | Approval checklist |
| D3 | Tick GMC + website (+ UK boxes if GB) | Verify enabled |
| D4 | Verify | Doctor gets verified email; status `verified` |
| D5 | Grant Subscription → Clinic, 30d trial | License `tier=clinic`, **max_seats=3** (not 5) |
| D6 | Waitlist tab | A4 entry status updatable to `contacted` |

---

## E. Legal + package copy (3 min)

| # | Step | Expected |
|---|------|----------|
| E1 | `/en/about` | No `TBD_` text; company name from env |
| E2 | `/en/terms`, `/en/privacy`, `/en/regulatory` | Same |
| E3 | `/en/pricing` | Monthly = no lock-in language; annual = 12-month / 2 free months |
| E4 | `/en/register-testing-service` | Real page (not coming-soon) |

---

## F. Negative / security smoke

| # | Step | Expected |
|---|------|----------|
| F1 | Non-admin visits `/en/admin` | Redirect away |
| F2 | Patient path `/en/doctors` on .co.uk | Coming-soon (still gated) |
| F3 | Register non-GB without GMC | Allowed if city/country set |
| F4 | Register GB without GMC via crafted POST | Server error: GMC required |

---

## Pass criteria

- All **A–E** expected columns green  
- Founding numbers increment and stop at 100  
- No `TBD_` on public legal pages  
- Clinic grant seats = 3  
- GMC required for UK on UI **and** server  

## Sign-off

| Role | Name | Date | Pass? |
|------|------|------|-------|
| Founder / PM | | | |
| Eng | | | |
| Ops (admin verify) | | | |
