import { APP_BRAND_HOST_SUFFIXES } from "@/lib/http/origin";

/** Default RP ID for production passkeys (must match Supabase Auth → Passkeys). */
export const DEFAULT_WEBAUTHN_RP_ID = "mydoctors360.com";

export function getConfiguredWebAuthnRpId(): string {
  const fromEnv = process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID?.trim().toLowerCase();
  if (fromEnv) return fromEnv.replace(/^https?:\/\//, "").split("/")[0];
  return DEFAULT_WEBAUTHN_RP_ID;
}

export function hostnameWithoutPort(host: string): string {
  return host.toLowerCase().trim().split(",")[0].replace(/:\d+$/, "");
}

/**
 * Passkeys are bound to a single Relying Party ID. Origins must be that
 * host or a subdomain of it. Loopback is always allowed for local HTTPS-less
 * WebAuthn. Other brand TLDs (.co.uk / .eu) cannot share the .com RP ID.
 */
export function hostMatchesWebAuthnRp(
  host: string,
  rpId: string = getConfiguredWebAuthnRpId()
): boolean {
  const h = hostnameWithoutPort(host);
  const rp = rpId.toLowerCase();
  if (!h || !rp) return false;
  if (h === "localhost" || h.startsWith("127.") || h === "[::1]") return true;
  return h === rp || h.endsWith(`.${rp}`);
}

export function isLikelyPublicBrandHost(host: string): boolean {
  const h = hostnameWithoutPort(host);
  return APP_BRAND_HOST_SUFFIXES.some((suffix) => h === suffix || h === `www.${suffix}`);
}

export function browserSupportsPasskeys(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof window.PublicKeyCredential === "function" &&
    typeof navigator.credentials?.create === "function" &&
    typeof navigator.credentials?.get === "function" &&
    window.isSecureContext
  );
}
