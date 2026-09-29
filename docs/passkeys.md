# Passkeys

Canonical docs: **[passkeys-and-mfa.md](./passkeys-and-mfa.md)** (sign-on, MFA hardening, dashboard RP setup).

## Security email

On successful passkey registration, Settings calls `notifyPasskeyAdded` (`src/actions/passkeys.ts`), which sends the monochrome **You Have Added A Passkey** template (`src/lib/email/security-templates.ts`) from `MyDoctors360 Account Security`.

Admin preview: Email Tests → **Security → Passkey Added**.
