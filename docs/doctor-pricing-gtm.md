# Doctor & clinic pricing — GTM packaging

**Updated:** 2026-07-23

## Positioning

| Tier | Role | Online bookings | AI (review summaries, tags) |
|------|------|-----------------|-----------------------------|
| **Free (Founding)** | Gateway signup — list + profile + verify | ❌ | ❌ |
| **Starter £199/mo** | Solo paid practice | ✅ | ✅ |
| **Professional £299/user** | Growth + CRM + waitlist auto-notify | ✅ | ✅ |
| **Clinic £1,495** | Multi-seat, multi-location, testing pack | ✅ | ✅ |
| **Enterprise** | Custom | ✅ | ✅ |
| **Testing addon +£49/mo** | Stripe line item on paid plans | with paid plan | — |
| **Extra seat +£299** | Pro/Clinic | — | — |

## Free gateway rules (product)

**Worth signing up:** account, org, free license, profile editor, specialties, public listing after admin verification, completion checklist.

**Must upgrade for:** online bookings, Stripe Connect payouts, video, reminders, messaging ops, analytics, care plans, waitlist auto-notify, **all AI features**.

Code: `hasFeature` treats null tier as free; free has empty feature set; booking rejects free; review-summary cron skips free orgs.

## Upsell moments

1. After free signup / OAuth bootstrap → billing CTA  
2. Profile completion “Upgrade to accept online bookings”  
3. Public book URL for free doctor → “coming soon / upgrade”  
4. Checkout cancel → resume paid plan on org billing  

## Implementation notes

- License checkout uses `getOrCreateLicensePriceId` (env `STRIPE_PRICE_*` preferred).
- Testing addon: `STRIPE_PRICE_TESTING_ADDON` + metadata `has_testing_addon=1`.
- Monthly is the sold cadence in code; annual is not the primary SKU yet.

## Marketing surfaces (aligned)

- `LICENSE_TIERS.free` → **Founding Free** features/exclusions drive pricing cards.
- `/en/pricing` — free is first-class card (£0, Start free, exclude list).
- `public/coming-soon/index.html` — free vs paid FAQ + CTA to `?tier=free`.
- Register-doctor free notice matches gateway copy.
