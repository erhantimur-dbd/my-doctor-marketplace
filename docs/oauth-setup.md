# OAuth / SSO setup runbook

Patient login and register support social SSO via **Supabase Auth**.  
Doctor and testing-service registration intentionally use **email/password only**.

## Launch providers

| Provider | UI default | Supabase config required |
|----------|------------|--------------------------|
| **Google** | Shown (`NEXT_PUBLIC_OAUTH_GOOGLE` defaults on) | Yes |
| **Apple** | Shown (`NEXT_PUBLIC_OAUTH_APPLE` defaults on) | Yes |
| Microsoft | Hidden until `NEXT_PUBLIC_OAUTH_MICROSOFT=true` | Yes |
| Facebook / X | Hidden (deferred) | N/A |

Hide a default-on provider: set `NEXT_PUBLIC_OAUTH_GOOGLE=false` (or Apple) in Vercel.

**Important:** `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in Vercel are for **Google Calendar**, not login SSO. Login credentials are stored only in Supabase → Authentication → Providers.

---

## 1. Supabase URL configuration

**Authentication → URL Configuration**

- **Site URL:** `https://mydoctors360.com`
- **Redirect URLs** (add all that apply):

```
https://mydoctors360.com/**
https://mydoctors360.co.uk/**
https://mydoctors360.eu/**
http://localhost:3000/**
https://*-erhan-timurs-projects.vercel.app/**
```

If wildcards are limited, add explicit locale callbacks, e.g.:

```
https://mydoctors360.com/en-GB/callback
https://mydoctors360.com/en-IE/callback
https://mydoctors360.com/it/callback
… (all launch locales)
```

App callback path: `/{locale}/callback` (PKCE).

Also enable **automatic linking** for verified emails when available (password account + Google same email).

---

## 2. Google (P0)

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials  
2. Create **OAuth 2.0 Client ID** (Web application)  
3. Authorized redirect URI (Supabase, not the app):

   ```
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

   Project ref example: `zlixmfcppzvbayyjymrv` →  
   `https://zlixmfcppzvbayyjymrv.supabase.co/auth/v1/callback`

4. OAuth consent screen: app name, support email, logo; publish when ready  
5. Supabase → Authentication → Providers → **Google** → paste Client ID + Secret → Enable  

---

## 3. Apple (P0)

1. [Apple Developer](https://developer.apple.com/) → Certificates, Identifiers & Profiles  
2. **Identifiers** → App ID with “Sign in with Apple”  
3. **Services ID** (used as Client ID in Supabase)  
   - Domains: `mydoctors360.com` (and `.co.uk` / `.eu` if needed)  
   - Return URL: `https://<project-ref>.supabase.co/auth/v1/callback`  
4. **Keys** → Sign in with Apple → download `.p8` (once)  
5. Supabase → Providers → **Apple**  
   - Services ID, Team ID, Key ID, private key contents  

Note: Apple “Hide My Email” is supported; profile enrichment handles sparse names.

### 3b. Private email relay (Option A — ship now with `.com`)

So platform emails reach users who chose **Hide My Email**, register the **existing Resend From domain** with Apple. Do **not** wait on `mydoctors360.co.uk` for launch.

**Sending identity (already in app):**

```text
EMAIL_FROM = MyDoctors360 <noreply@mydoctors360.com>
```

**DNS already in place (verified 2026):**

| Record | Status |
|--------|--------|
| `resend._domainkey.mydoctors360.com` (DKIM) | Present |
| `send.mydoctors360.com` TXT SPF `v=spf1 include:amazonses.com ~all` | Present |
| `send.mydoctors360.com` MX → SES feedback | Present |
| Apex `mydoctors360.com` SPF | Not required if DKIM path passes |

**Register these Email Sources in Apple** (Account Holder or Admin):

1. Open [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources)  
2. Sidebar → **Services**  
3. **Sign in with Apple for Email Communication** → **Configure**  
4. **Email Sources** → **+**  
5. Add (comma-separated is fine, or one at a time):

```text
mydoctors360.com
send.mydoctors360.com
noreply@mydoctors360.com
```

Optional extras if you ever send From them via Resend:

```text
support@mydoctors360.com
hello@mydoctors360.com
```

6. Confirm → **Register**  
7. Table must show **SPF / auth pass** for the domains (refresh after a minute if pending)

**Why both domains?**

- `mydoctors360.com` — matches **From:** and Resend **DKIM `d=`**  
- `send.mydoctors360.com` — matches Resend **Return-Path / envelope sender** (SPF path)

**Do not register for Option A:**

- `mydoctors360.co.uk` / `hello@mydoctors360.co.uk` until that domain is verified in Resend with SPF+DKIM (Option B later)

**App / Vercel:** keep `EMAIL_FROM` on `noreply@mydoctors360.com` (or any Resend-verified address on `.com` that you also registered above). No code change required.

**Smoke test:**

1. Sign in with Apple → **Hide My Email**  
2. Complete accept-terms (welcome email) or create a booking email  
3. Mail arrives in the real Apple ID inbox via relay  
4. If bounce: check Apple Email Sources still “pass”, and Account Holder email for relay failure notices  

Full Apple doc: [Configure private email relay service](https://developer.apple.com/help/account/capabilities/configure-private-email-relay-service/)

---

## 4. Microsoft (P1 — optional)

1. Azure Portal → App registrations → New  
2. Redirect URI (Web): `https://<project-ref>.supabase.co/auth/v1/callback`  
3. Create client secret  
4. Supabase → Providers → **Azure** → Client ID, Secret, tenant (`common` for work + personal)  
5. Set `NEXT_PUBLIC_OAUTH_MICROSOFT=true` in Vercel  

---

## 5. App env flags (Vercel)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_OAUTH_GOOGLE` | Default on; set `false` to hide button |
| `NEXT_PUBLIC_OAUTH_APPLE` | Default on; set `false` to hide button |
| `NEXT_PUBLIC_OAUTH_MICROSOFT` | Default off; set `true` when Azure is ready |

Redeploy after changing `NEXT_PUBLIC_*` vars.

---

## 6. User flows

### Patient OAuth (new user)

1. `/login` or `/register` → Continue with Google/Apple  
2. IdP consent → Supabase → `/{locale}/callback`  
3. Profile name/avatar filled from provider metadata  
4. If `terms_accepted_at` is null → `/{locale}/accept-terms`  
5. Accept checkbox → welcome email + dashboard (or `?next=` booking URL)

### Patient OAuth (returning user)

Callback → dashboard (or `next`) if terms already accepted.

### Doctor / testing service

Email + password wizard only. No SSO buttons (avoids accidental patient-role accounts).

---

## 7. Smoke tests

- [ ] Google: new user → accept terms → patient dashboard; name present  
- [ ] Apple: Hide My Email still creates account  
- [ ] Apple private relay: welcome/booking email reaches Hide My Email user (Email Sources green for `mydoctors360.com` + `send.mydoctors360.com`)  
- [ ] Booking `?redirect=` preserved through OAuth + accept-terms  
- [ ] Facebook / X / Microsoft buttons **not** shown (unless flags on)  
- [ ] Doctor register has **no** social buttons  
- [ ] Locales `en-GB`, `tr`, `de` callbacks succeed  
- [ ] `.co.uk` / `.eu` hosts if used in production  

---

## Code map

| Path | Role |
|------|------|
| `src/lib/auth/oauth-providers.ts` | Enabled provider list + `TERMS_VERSION` |
| `src/components/auth/oauth-buttons.tsx` | Shared SSO buttons |
| `src/actions/auth.ts` | `signInWithOAuthProvider` |
| `src/app/[locale]/(auth)/callback/route.ts` | PKCE exchange + terms gate |
| `src/app/[locale]/(auth)/accept-terms/` | Consent interstitial |
