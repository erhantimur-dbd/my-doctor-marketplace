# Passkeys (WebAuthn) + MFA

**Status:** Implemented in app (experimental Supabase Auth passkey API)  
**Date:** 2026-09-29

## What shipped

1. **Passkeys for sign-on** — users can register passkeys in Security settings and sign in from `/login` with Face ID / Touch ID / Windows Hello / security keys.
2. **Hardened TOTP 2FA** — enrollment now persists the AAL2 session; verify page supports multiple authenticators; backup TOTP factor; MFA redirects preserve the original destination; OAuth/magic-link callbacks enforce MFA when enrolled.

## Dashboard prerequisites (required)

Passkeys are **off** until enabled in the Supabase project:

1. Authentication → **Passkeys** → Enable  
2. Relying Party Display Name: `MyDoctors360`  
3. Relying Party ID: `mydoctors360.com` (stable; changing this invalidates every existing passkey)  
4. Relying Party Origins (examples):

```
https://www.mydoctors360.com,https://mydoctors360.com,http://localhost:3000
```

Optional app env (defaults to `mydoctors360.com`):

```
NEXT_PUBLIC_WEBAUTHN_RP_ID=mydoctors360.com
```

**Note:** Passkeys are cryptographically bound to one RP ID. `.co.uk` / `.eu` hosts cannot share a `.com` RP ID. The UI hides passkey enrollment/sign-in on hosts that do not match the configured RP ID (localhost always allowed for local testing).

Requires `@supabase/supabase-js` **≥ 2.105** for `registerPasskey` / `signInWithPasskey`.

## Client opt-in

All Supabase clients pass `auth.experimental.passkey: true` via `src/lib/supabase/auth-options.ts`.

## 2FA review notes (fixed)

| Issue | Fix |
|-------|-----|
| After TOTP enroll, session stayed AAL1 until next login | Call `completeMfaLogin` with verify tokens after enroll/disable |
| `/verify-mfa` dropped booking/dashboard return URL | Pass `?redirect=` from login + middleware |
| Only one TOTP factor UX | List factors + optional backup authenticator |
| No recovery path if authenticator lost | MFA recovery codes (generate after enroll; verify on `/verify-mfa`) |
| “Back to login” left AAL1 session active | `cancelMfaLogin` signs out |
| MFA complete accepted any string as tokens | JWT/refresh shape checks + rate limit |
| OAuth users with MFA could skip verify | Callback checks AAL before final redirect |

Supabase MFA recovery codes are enabled in the client via
`auth.experimental.recoveryCodes: true`. They must also be enabled on the
Supabase Auth server (Dashboard → Authentication → MFA / recovery codes when
available). If the server flag is off, TOTP still works; generate will show an
error toast.

## Related

- `docs/ADR-auth-supabase.md`
- `docs/oauth-setup.md`
