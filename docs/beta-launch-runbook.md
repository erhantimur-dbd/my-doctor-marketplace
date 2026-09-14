# Beta launch + demo cutover

Order matters so demo never loses seed and live never shows fictional doctors.

## Topology

| Host | Vercel | Database | Stripe |
|------|--------|----------|--------|
| `demo.mydoctors360.com` | New project `mydoctors360-demo` | **Current** seeded Supabase | Test keys |
| `www` / `.eu` / `.co.uk` / `.com` | Existing `mydoctors360` | **New** empty Supabase | Live keys |

Set `NEXT_PUBLIC_SITE_MODE=demo` only on the demo project.

## Seeds

- Live: `supabase/seed-catalog.sql` only (specialties, locations, settings).
- Demo: `seed-catalog.sql` then `supabase/seed-demo.sql` (personas). Never run `seed-demo.sql` on live.

Real founding doctors: copy rows whose ids are **not** `e0000000-%` / `c0000000-%` / `d0000000-%` and emails are **not** `@example.com`.

## Steps

1. Merge PR #21. Apply `00109_gtm_p0_signup_rls.sql` on the **current** database.
2. Create live Supabase (`mydoctors360-live`). Apply all migrations through 00109. Run `seed-catalog.sql`. Copy real founders.
3. Create Vercel project `mydoctors360-demo` from this repo. Env: current Supabase, Stripe **test**, `NEXT_PUBLIC_SITE_MODE=demo`, `NEXT_PUBLIC_APP_URL=https://demo.mydoctors360.com`. Attach `demo.mydoctors360.com`.
4. Point production Vercel Supabase env at the live project. Confirm `/en/doctors` has no `@example.com` listings.
5. Deploy this beta-launch branch to **both** projects (coming-soon is off in code).
6. Stripe: live webhook + Price IDs on production; test keys on demo.
7. Smoke: approve a test doctor on live; book a seed doctor on demo with a test card.

## Rollback

Restore `SOFT_LAUNCH_HIDE_PATIENT_MARKETPLACE_CHROME = true` and the previous `vercel.json` coming-soon rewrite. Demo project is independent.

## Not done from this repo

Provisioning the new Supabase project, DNS for `demo.mydoctors360.com`, and swapping Vercel env need dashboard access (database password / Vercel project create).
