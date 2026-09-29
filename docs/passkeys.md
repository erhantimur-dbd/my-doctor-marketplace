# Passkeys (WebAuthn)

MyDoctors360 supports passkeys for passwordless sign-in via Supabase Auth.

## Enable in Supabase Dashboard

1. Open **Authentication → Passkeys**
2. Turn on **Enable Passkey authentication**
3. Set Relying Party details:
   - **Display name:** `MyDoctors360`
   - **RP ID:** bare domain (e.g. `mydoctors360.com`) — no scheme/port/path
   - **Origins:** production + preview origins that serve the app over HTTPS
     (e.g. `https://mydoctors360.com`, plus Vercel preview hosts if needed)

Passkeys are bound to the RP ID. Changing it later invalidates existing passkeys.

## App behaviour

- **Settings → Passkeys:** create, list, and remove passkeys (patient + doctor settings)
- On successful create, users receive the Tesla-style **You Have Added A Passkey** security email
- **Login:** “Sign in with passkey” runs the discoverable-credential ceremony

Requires `@supabase/supabase-js` ≥ 2.105 (project uses a current 2.117.x).

## Local / preview notes

- HTTPS is required except for `localhost` / `127.0.0.1`
- If the dashboard toggle is off, register/sign-in return `passkey_disabled`
