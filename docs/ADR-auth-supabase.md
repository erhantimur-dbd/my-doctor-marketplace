# ADR: Authentication stays on Supabase Auth

**Status:** Accepted  
**Date:** 2026-08-11  
**Context:** Evaluation of Clerk.com for MD360 soft-launch

## Decision

Keep **Supabase Auth** as the identity provider. Do **not** integrate Clerk (or another hosted IdP) before / during founder doctor soft-launch.

## Reasons

1. ~150+ files and RLS policies depend on `auth.uid()` / Supabase sessions.
2. Multi-role marketplace (patient, doctor, admin, org seats) is already modeled in Postgres.
3. Clerk would be a multi-week migration with high risk and little product value for bookings/compliance.
4. Auth UX gaps are better fixed **in place** (password rules, verify email, reset locale, terms).

## Consequences

- Continue polishing existing login/register/MFA/verify flows.
- Revisit Clerk / WorkOS only post-beta if enterprise SSO is a closed-won requirement.

## Related

- Founder go-live work on branch `fix/founder-signup-go-live`
- Plan evaluation: Clerk for MD360 (Option D)
