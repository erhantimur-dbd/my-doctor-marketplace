# Admin Portal — Operations Checklist

Use this after deploy or before beta. All paths assume locale prefix e.g. `/en/admin`.

## Preflight access

- [ ] `ADMIN_EMAILS` set in Vercel (Production + Preview) with your email
- [ ] Supabase `profiles.role = 'admin'` for that user
- [ ] Login → lands on `/admin` (not coming-soon page)
- [ ] Non-admin account redirected away from `/admin`
- [ ] ⌘K / Ctrl+K command palette shows Admin Portal commands

## Navigation smoke

Open each sidebar group and confirm page loads (data or empty state):

- [ ] Overview `/admin`
- [ ] Approvals, Support, Inquiries, Audit Log
- [ ] Doctors, Patients, Organizations
- [ ] Bookings, Reviews, Featured, Waitlist
- [ ] Revenue, Payments, Licenses, Coupons
- [ ] Blog, Analytics, NPS Surveys, Email Tests
- [ ] System Health, Settings
- [ ] `/admin/subscriptions` redirects to Licenses

## Core workflows

| # | Workflow | Pass? | Notes |
|---|----------|-------|-------|
| 1 | Approve doctor (checklist → verified) | | |
| 2 | Deactivate / unfeature doctor | | |
| 3 | Moderate review (approve / hide / bulk) | | |
| 4 | Edit review keyword blocklist in Settings | | |
| 5 | Create booking on behalf | | |
| 6 | Resend payment link | | |
| 7 | Refund / cancel booking (Stripe test) | | |
| 8 | Create + toggle coupon | | |
| 9 | Grant doctor subscription / create license | | |
| 10 | Support ticket reply | | |
| 11 | Blog publish → public slug | | |
| 12 | Waitlist status update | | |
| 13 | Patient suspend + password reset | | |
| 14 | Patient wallet credit | | |
| 15 | Platform setting save | | |
| 16 | Impersonate doctor view + audit log | | |
| 17 | CSV export (bookings / revenue) | | |
| 18 | System Health shows env presence | | |
| 19 | Contact inquiry mark read / archive | | |
| 20 | NPS Surveys list + distribution | | |

## Production notes

- Coming-soon allowlist must include `admin` in both `vercel.json` and `middleware.ts`.
- Prefer Stripe **test** keys for refund drills until launch checklist is complete.
- Audit log should show privileged mutations (`wallet_credit_manual`, `setting_updated`, etc.).
