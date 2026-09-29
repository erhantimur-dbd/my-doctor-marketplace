/** Shared Auth client options (passkeys + MFA recovery codes). */
export const SUPABASE_AUTH_CLIENT_OPTIONS = {
  experimental: {
    // Deprecated no-op for passkeys (enabled by default in supabase-js ≥ 2.105);
    // kept so older clients and docs stay aligned.
    passkey: true,
    recoveryCodes: true,
  },
} as const;
