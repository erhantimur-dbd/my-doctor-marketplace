/**
 * Resolve the public app origin for redirects, Stripe return URLs, and emails.
 *
 * Prefer the incoming request host so doctors on .co.uk / .eu / .com stay on
 * the TLD they used. Fall back to NEXT_PUBLIC_APP_URL for crons / no-request.
 */

import { headers } from "next/headers";

/** Production brand hosts (apex + www). */
export const APP_BRAND_HOST_SUFFIXES = [
  "mydoctors360.com",
  "mydoctors360.co.uk",
  "mydoctors360.eu",
] as const;

const LOCALE_RE = /\/(en|de|tr|fr|it|es|pt|zh|ja)(\/|$)/;

/**
 * Canonicalise production apex → www so soft-launch and cookies stay consistent.
 * Preview (*.vercel.app) and localhost are left unchanged.
 */
export function canonicalizeAppHost(host: string): string {
  const first = host.toLowerCase().trim().split(",")[0].trim();
  if (!first) return first;

  const portMatch = first.match(/:(\d+)$/);
  const port = portMatch?.[1] ?? null;
  const withoutPort = first.replace(/:\d+$/, "");

  for (const suffix of APP_BRAND_HOST_SUFFIXES) {
    if (withoutPort === suffix) return `www.${suffix}`;
    if (withoutPort === `www.${suffix}`) return withoutPort;
  }

  // Keep localhost:port for local OAuth / Stripe return URLs
  if (
    port &&
    (withoutPort === "localhost" ||
      withoutPort.startsWith("127.") ||
      withoutPort.startsWith("0.0.0.0"))
  ) {
    return `${withoutPort}:${port}`;
  }

  return withoutPort;
}

export function resolveAppOrigin(input: {
  host?: string | null;
  forwardedHost?: string | null;
  proto?: string | null;
  fallback?: string | null;
}): string {
  const raw = (input.forwardedHost || input.host || "")
    .split(",")[0]
    .trim();

  if (raw) {
    const host = canonicalizeAppHost(raw);
    const isLocal =
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      host.startsWith("0.0.0.0");
    let proto = (input.proto || (isLocal ? "http" : "https")).toLowerCase();
    // Never emit http:// on production brand hosts
    if (!isLocal && proto === "http") proto = "https";
    return `${proto}://${host}`;
  }

  const fallback =
    input.fallback ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";
  return fallback.replace(/\/$/, "");
}

/** Absolute origin for the current server action / RSC request. */
export async function getRequestOrigin(): Promise<string> {
  const h = await headers();
  return resolveAppOrigin({
    host: h.get("host"),
    forwardedHost: h.get("x-forwarded-host"),
    proto: h.get("x-forwarded-proto"),
    fallback: process.env.NEXT_PUBLIC_APP_URL,
  });
}

/**
 * Origin + locale (from Referer path when present).
 * Used by booking / checkout actions.
 */
export async function getRequestOriginAndLocale(
  defaultLocale: string = "en"
): Promise<{ origin: string; locale: string }> {
  const h = await headers();
  const origin = resolveAppOrigin({
    host: h.get("host"),
    forwardedHost: h.get("x-forwarded-host"),
    proto: h.get("x-forwarded-proto"),
    fallback: process.env.NEXT_PUBLIC_APP_URL,
  });
  const referer = h.get("referer") || "";
  const localeMatch = referer.match(LOCALE_RE);
  const locale = localeMatch ? localeMatch[1] : defaultLocale;
  return { origin, locale };
}

/** Fallback origin when no request headers exist (cron, background jobs). */
export function getConfiguredAppOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL || "https://www.mydoctors360.com"
  ).replace(/\/$/, "");
}
