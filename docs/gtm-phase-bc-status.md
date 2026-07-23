# GTM Phase B & C status

**Updated:** 2026-07-23  
**Stripe plugin:** installed (`stripe/ai` → Grok providers/plugin v0.2.0)

## Phase B — verification (no production gate lift)

### B0 — Preview host (ungated)

Host: `https://mydoctors360-app.vercel.app`

| Check | Result |
|-------|--------|
| `/en` marketplace home | 200 |
| `/en/doctors` Find a Doctor | 200 (not coming-soon) |
| Legal: about, cookie-policy, privacy, terms | 200 |
| Auth/doctor soft paths | 200 |
| `/api/health` | 200 |
| Production `www.mydoctors360.eu/` | Still coming-soon (expected) |

Automated contracts (vitest):

- `src/lib/booking/__tests__/confirmation-params.test.ts` — wallet vs Stripe confirmation lookup
- `src/lib/booking/__tests__/stripe-checkout-shape.test.ts` — Connect destination charge, no `payment_method_types`, success URL shapes
- Guest booking validators + search empty-state / profile-fit tests

### B1 — After gate lift (not done this session)

Still required on production hosts: full book → live Stripe card → email → cron. Depends on Phase A (env + gate lift).

## Phase C — post-open conversion / GTM hygiene (shipped this session)

| Item | Status |
|------|--------|
| Wallet-only pay dumped users home (`?booking_id=&wallet=true` ignored) | **Fixed** — confirmation page accepts wallet path with auth ownership |
| Confirmation page i18n for key strings | **Partial** — uses `booking` namespace for confirmed/number/policies/deposit |
| Guest claim CTA clarity | **Improved** — note to use confirmation email |
| `.env.example` Stripe Price IDs + support domain | **Updated** |
| Guest checkout / wizard i18n | **Already in product** (research doc partially stale) |

## Phase 4 + guest claim (2026-07-23 follow-up)

| Item | Status |
|------|--------|
| Guest magic-link claim email | **Shipped** — recovery link via Resend after guest Stripe pay; `/reset-password` page; gate allowlist |
| NPS surveys | **Already wired** — cron, email, `/survey/[token]`, admin NPS card |
| Waitlist auto-notify | **Shipped Pro gate + schedule/override hooks** (cancel was already wired) |
| Voice multi-turn tools (P2) | **Already wired** — refine/soonest/filters |
| Voice proposeBooking (P3) | **Shipped** — tool + confirm UI; never auto-books |

## Not done (still open)

1. Production gate lift (Phase A / H1)  
2. Live Stripe keys verification in Vercel  
3. Real card E2E on production  
4. Full confirmation page label i18n for Doctor/Date/Time rows  
5. Guest claim email on follow-up / non-primary checkout paths if any  
6. NPS deep-dive analytics page (homepage card exists)

## How to re-run Phase B0

```bash
# Preview smoke (requires network)
BASE=https://mydoctors360-app.vercel.app
curl -sL -A "Mozilla/5.0" -o /dev/null -w "%{http_code}\n" "$BASE/en/doctors"

# Contracts
npx vitest run src/lib/booking/__tests__ src/lib/validators/__tests__/booking-guest.test.ts
```
