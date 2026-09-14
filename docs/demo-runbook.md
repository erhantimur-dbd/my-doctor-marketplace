# Demo site runbook

Internal only. Do not publish seed credentials.

## Purpose

`demo.mydoctors360.com` is a full product tour with fictional doctors. Payments use Stripe test mode. SMS and WhatsApp are skipped in code when `NEXT_PUBLIC_SITE_MODE=demo`.

## Env (demo Vercel project)

- Current (seeded) `NEXT_PUBLIC_SUPABASE_URL` / anon / service role
- Stripe **test** secret, publishable, webhook, Price IDs
- `NEXT_PUBLIC_SITE_MODE=demo`
- `NEXT_PUBLIC_APP_URL=https://demo.mydoctors360.com`
- Omit Twilio / WhatsApp tokens if possible

## Reset personas

In the **demo** SQL editor, re-run `supabase/seed-demo.sql` (after catalog). Do not run it on live.

## Checks

- Amber banner: “Demo — fictional doctors, test cards only.”
- `/robots.txt` disallows all
- Search lists seed doctors
- Test card booking completes
- Header shows Beta

Seed login accounts live in `seed-demo.sql` (auth users section). Keep them off public pages.
