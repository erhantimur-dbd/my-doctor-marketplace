/**
 * OAuth / SSO provider configuration for patient login & register.
 *
 * Credentials live in Supabase Dashboard → Authentication → Providers
 * (not Vercel env). These flags only control which buttons are shown.
 *
 * Google + Apple: on by default (launch set). Set NEXT_PUBLIC_OAUTH_*=false to hide.
 * Microsoft: opt-in via NEXT_PUBLIC_OAUTH_MICROSOFT=true after Azure is configured.
 * Facebook / X: deferred — never shown unless explicitly enabled later.
 */

export type OAuthProviderId =
  | "google"
  | "apple"
  | "azure"
  | "facebook"
  | "twitter";

export type OAuthProviderConfig = {
  id: OAuthProviderId;
  /** next-intl key under `auth.*` */
  labelKey:
    | "continue_with_google"
    | "continue_with_apple"
    | "continue_with_facebook"
    | "continue_with_microsoft"
    | "continue_with_x";
  /** Supabase Auth provider name */
  supabaseProvider: OAuthProviderId;
  enabled: boolean;
};

function envEnabled(name: string, defaultOn: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return defaultOn;
  return raw === "true" || raw === "1";
}

/**
 * Current terms version stamped on accept (keep in sync with email/password
 * registration in src/actions/auth.ts).
 */
export const TERMS_VERSION = "2026-03-17";

export const OAUTH_PROVIDERS: OAuthProviderConfig[] = [
  {
    id: "google",
    labelKey: "continue_with_google",
    supabaseProvider: "google",
    enabled: envEnabled("NEXT_PUBLIC_OAUTH_GOOGLE", true),
  },
  {
    id: "apple",
    labelKey: "continue_with_apple",
    supabaseProvider: "apple",
    enabled: envEnabled("NEXT_PUBLIC_OAUTH_APPLE", true),
  },
  {
    id: "azure",
    labelKey: "continue_with_microsoft",
    supabaseProvider: "azure",
    // Microsoft is P1 — opt-in only after Azure app is configured in Supabase
    enabled: envEnabled("NEXT_PUBLIC_OAUTH_MICROSOFT", false),
  },
  {
    id: "facebook",
    labelKey: "continue_with_facebook",
    supabaseProvider: "facebook",
    enabled: envEnabled("NEXT_PUBLIC_OAUTH_FACEBOOK", false),
  },
  {
    id: "twitter",
    labelKey: "continue_with_x",
    supabaseProvider: "twitter",
    enabled: envEnabled("NEXT_PUBLIC_OAUTH_TWITTER", false),
  },
];

export function getEnabledOAuthProviders(): OAuthProviderConfig[] {
  return OAUTH_PROVIDERS.filter((p) => p.enabled);
}
