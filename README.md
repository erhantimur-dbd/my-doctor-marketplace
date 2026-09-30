# my-doctor-marketplace
Doctor marketplace

## Ops scripts

`scripts/repair-confirmed-video-booking.ts` imports booking finalisation, which pulls in modules marked `server-only`. Plain `npx tsx` throws on that import. Run both video scripts with the React server condition so Node loads the empty `server-only` stub:

```
NODE_OPTIONS=--conditions=react-server npx tsx scripts/repair-confirmed-video-booking.ts <id>
NODE_OPTIONS=--conditions=react-server npx tsx scripts/lock-daily-rooms.ts --help
DAILY_API_KEY=... NODE_OPTIONS=--conditions=react-server npx tsx scripts/lock-daily-rooms.ts --dry-run
DAILY_API_KEY=... NODE_OPTIONS=--conditions=react-server npx tsx scripts/lock-daily-rooms.ts
```

`--help` prints usage and does not call Daily or the database. A real repair also needs `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `DAILY_API_KEY`.

---

## Development Log

### Phase 4 — Complete ✅
*18 March 2026 — commit `49bcb00` (50 files, +1500/-218 lines)*

#### Infrastructure
- **Structured logging** — 208 `console.error/warn` calls across 38 files migrated to `log.error/warn`. JSON output in production, coloured output in dev. Sensitive data redaction built in.

#### Business Features

**Patient Satisfaction Surveys (NPS)**
- `satisfaction_surveys` table + daily cron (10am) sends survey 24h after completed bookings
- Public survey page with NPS 0–10 + free-text feedback
- NPS score widget on admin dashboard

**Waitlist Auto-Notify**
- When bookings are cancelled (patient or admin), waitlisted patients automatically receive email + in-app notification
- New `availabilityAlertEmail` template

**Revenue Forecasting**
- Linear regression on monthly data → 3-month predicted revenue with R² confidence score
- Booking velocity chart (trend vs previous period)

**Org-Scoped Dashboard**
- Org admins see all bookings + analytics across their practice
- Per-doctor performance breakdown
- New sidebar nav links

#### Files Created
- `src/actions/surveys.ts` — survey submit + token lookup
- `src/actions/org-dashboard.ts` — org bookings + analytics
- `src/app/api/cron/satisfaction-surveys/route.ts` — daily survey sender
- `src/app/[locale]/(public)/survey/[token]/` — public survey page + form
- `src/app/[locale]/(doctor)/doctor-dashboard/organization/bookings/` — org bookings
- `src/app/[locale]/(doctor)/doctor-dashboard/organization/analytics/` — org analytics
- `src/lib/utils/forecast.ts` — regression + velocity math
- `supabase/migrations/00072_satisfaction_surveys.sql`
