# Soft Launch Soft CTA checklist

**Audience:** Parker (Product), Quinn (Legal/Marketing claims), Sandy (Creative/Preview stamp), John (Legal).  
**Scope:** Founding doctor Soft Launch on `main` tip (#18 clinical hard-disable + #28 pricing copy) plus this Founding Free = lifetime Professional preview.  
**Do not merge. Do not promote. Do not lift WABA / outbound / #19 unless signup smoke requires it.**

## Product lock (Erhan)

| Lock | Stamp |
|------|--------|
| Founding Free / founding licence maps to **Solo Professional feature entitlements for life** (not a time-boxed trial) | Parker |
| Soft Launch claim value **£299/month**; list price **Founding Free £0** | Parker + Quinn |
| Founding Free = Professional **non-clinical** entitlements only (seats, booking, video, payments, dashboard, analytics, CRM, waitlist) | Parker |
| PR #18 kill-switch stays **ON**: prescriptions, care plans, public chat / `analyzeSymptoms` / Grok voice STT-TTS remain fail-closed | John + Parker |
| Copy does **not** claim live SMS/WhatsApp (Coming) or a care marketplace | Quinn + Sandy |

## Soft CTA surfaces to re-stamp on Preview

Walk each URL as a doctor (not a patient). Confirm the one-liner is present: **lifetime Professional equivalent · value £299/mo · Founding Free £0**.

| # | Surface | URL | Soft CTA check | Owner |
|---|---------|-----|----------------|-------|
| 1 | Coming-soon founding band | `/coming-soon/index.html` | Primary **Claim My Founding Spot** → `/en/register-doctor?tier=free&founding=1`. Fine print: lifetime Pro equivalent, £299 value, £0. No live SMS/WhatsApp. No care-marketplace title. | Sandy + Quinn |
| 2 | Pricing hero + cards | `/en/pricing` | Founding Free card: £0, lifetime Professional equivalent, value £299/mo. Footer: SMS/WhatsApp Coming — not available at Soft Launch. Title is Founding Doctor Programme, not a care marketplace. | Quinn + Sandy |
| 3 | Register-doctor wizard | `/en/register-doctor?tier=free&founding=1` | First screen (under H1, before the form): quiet chrome **lifetime Founding Free · Solo Professional · value £299/mo**. Default plan is Founding Free. Plan step notice matches lifetime Pro / £299 / £0. No “upgrade to unlock bookings”. No “free forever”. | Parker + Sandy |
| 4 | How it works | `/en/how-it-works` | FAQ “What does Founding Free include?” matches the lock. Legal marketplace disclaimer (“not a care provider”) still present. | Quinn + John |
| 5 | Login / register chrome | `/en/login`, `/en/register` | Titles stay Founding Doctor Programme. Patient register still points doctors at Founding Free. | Sandy |
| 6 | Doctor dashboard (after signup) | `/en/doctor-dashboard` | Founding banner: lifetime Professional equivalent, £299/mo value, £0. No “upgrade to unlock bookings/video”. Profile checklist asks for Stripe Connect (payouts), not a paid upgrade. | Parker |
| 7 | Clinical surfaces (negative) | `/en/doctor-dashboard/prescriptions`, `/treatment-plans`, public chat | Unavailable / fail-closed. Copy does **not** say upgrade or unlock. | John |
| 8 | Invite path (as implemented) | `/en/invite/[token]` | Clinic seat invite still works. Does not grant Founding Free to invitees on someone else’s Clinic licence. Referrals (`?ref=`) stay independent accounts. | Parker |

## Copy do / don’t

**Do say**

- Lifetime Solo Professional equivalent
- Value £299/mo
- Founding Free £0 — no card required
- SMS and WhatsApp reminders are coming soon — not available at Soft Launch
- MyDoctors360 is a marketplace platform, not a care provider

**Do not say**

- Free forever
- Locked in for life (use “lifetime Professional equivalent”)
- Live SMS / WhatsApp / WABA
- Care plans, prescriptions, or “care marketplace” as a Soft Launch offer
- Upgrade to unlock bookings / video / AI on Founding Free

## Entitlement proof (eng)

- Stored licence stays `licenses.tier = free` (billing identity, £0, no Stripe).
- `hasFeature(*, "free") === hasFeature(*, "professional")` for the Professional matrix.
- `hasFeature(*, null)` stays false (no licence ≠ Founding Free).
- `isPrescriptionsEnabled()` / `isCarePlansEnabled()` / `isPublicChatEnabled()` remain `false`.
- Seats stay **1** (solo). Clinic 3–15 is the only multi-doctor upgrade.

## Sign-off

| Role | Name | Preview URL | Pass? | Date |
|------|------|-------------|-------|------|
| Product | Parker | | | |
| Legal / claims | Quinn | | | |
| Creative / Preview | Sandy | | | |
| Legal (clinical kill-switch) | John | | | |
