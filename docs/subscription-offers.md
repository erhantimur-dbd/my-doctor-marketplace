# Doctor subscription offers

Founder-only, Stripe **test mode** only. Not linked from public marketing. Monthly plans and Founding Free are unchanged.

## Migration

`supabase/migrations/00114_subscription_offers.sql`

Infra applies this to Production separately. The migration does **not** create Stripe prices, coupons, or promotion codes.

Tables:

- `subscription_offers` — source of truth (`percent_first_year` or `free_trial`)
- `subscription_offer_invites` — signup links
- `subscription_offer_attributions` — which offer and specialty a signup came through
- `plan_price_versions` — new annual Stripe prices (old prices are never edited)
- `subscription_price_schedules` — renewal switches, including when the 30-day notice is due
- `service_email_sends` — one row per subscription + event

`licenses` gains `offer_id`, `attribution_specialty`, `offer_invite_id`, and `billing_period`.

## Environment

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Must be `sk_test_…`. Offer create, price change, checkout, and cancel refuse any other key. |
| `STRIPE_PRICE_STARTER_ANNUAL` | Public annual Solo checkout. Offer checkout does not use this when a test-mode `plan_price_versions` row exists. |
| `STRIPE_PRICE_PROFESSIONAL_ANNUAL` | Public annual Pro checkout. Same split as Solo. |
| `OFFER_ADMIN_EMAILS` | Comma-separated founder allowlist. Empty denies everyone. Checked in server actions, not only the UI. The founder must also be an admin on `ADMIN_EMAILS`. |
| `CRON_SECRET` | Existing cron auth. New job: `GET /api/cron/subscription-service-emails` daily at 08:00 UTC. |

Service emails send only to the existing Softsmoke address (`dbd.demo.email@gmail.com`) until that allowlist is removed in a later launch change. Other recipients are not sent. Each skip writes a `suppressed` audit row on its own key, so the same reminder can still go out after launch. The trial reminder quotes the subscription's own price.

## Stripe objects (created by the script or admin, not by this PR)

- Annual prices: Solo £1,990/year, Pro £2,990/year (`interval: year`). A later price change creates a **new** price.
- Discount offers: coupon `duration: once` (first annual invoice only) and a promotion code whose `expires_at` is the offer `redeem_by`.
- Trial offers: no coupon. Checkout sets `subscription_data.trial_period_days` and `payment_method_collection: always`.
- Existing annual subscribers move via a subscription schedule at a renewal that is at least 30 days away. The price-change email is sent from that schedule.

Stripe does not allow `allow_promotion_codes` together with `discounts`. Percent-off checkout applies the promotion code via `discounts` (no second code box). Trial checkout sets `allow_promotion_codes: false`. Both paths reject a second code on the server.

Checkout is refused before the attribution claim and before any Stripe call when the practice already has a licence in `active`, `trialing`, or `past_due`, including a paying monthly or annual licence with no offer. The database unique index stays offer-only. If a webhook offer update still hits that index, the failure is logged and written to `audit_log` (`offer_subscription_orphaned`) for an admin.

## Seed

Apply the migration, then:

```bash
STRIPE_SECRET_KEY=sk_test_... \
NEXT_PUBLIC_SUPABASE_URL=... \
SUPABASE_SERVICE_ROLE_KEY=... \
npx tsx scripts/seed-subscription-offers.ts
```

The script is idempotent. It prints `STRIPE_PRICE_STARTER_ANNUAL` and `STRIPE_PRICE_PROFESSIONAL_ANNUAL`. Example offers:

- 50% off first year
- 25% off first year
- Free for 3 months (90-day trial)

## Founder tools

- `/en/admin/subscription-offers` — create or switch off an offer
- `/en/admin/subscription-offers/invite` — specialty, live offer, doctor email, signup link and QR. No email is sent. Specialty-benefits mail is a hook only (`specialtyBenefitsEmailHook`).
- `/en/admin/subscription-offers/prices` — new annual price and renewal schedules

Signup link: `/en/register-doctor/offer?invite=…` (noindex, invalid without a live invite).

## Cancel

Annual trial: cancel at the trial end, no invoice, no refund. Access end date is shown.

Paid annual year: `cancel_at_period_end`, no refund, access until the period end, no renewal.

Monthly and Founding Free keep the existing billing path.
