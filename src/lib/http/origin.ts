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

function hostnameFromEnvUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const withProto = value.includes("://") ? value : `https://${value}`;
    const hostname = new URL(withProto).hostname.toLowerCase();
    return hostname || null;
  } catch {
    const host = value
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .replace(/:\d+$/, "");
    return host || null;
  }
}

/** Hostnames for this Vercel deployment (not arbitrary *.vercel.app). */
export function vercelDeploymentHosts(
  env: NodeJS.ProcessEnv = process.env
): Set<string> {
  const hosts = new Set<string>();
  for (const key of [
    "VERCEL_URL",
    "VERCEL_BRANCH_URL",
    "VERCEL_PROJECT_PRODUCTION_URL",
  ] as const) {
    const host = hostnameFromEnvUrl(env[key] || "");
    if (host) hosts.add(host);
  }
  return hosts;
}

function stripHostPort(host: string): string {
  return host.toLowerCase().replace(/:\d+$/, "");
}

function isLocalHostName(h: string): boolean {
  return h === "localhost" || h.startsWith("127.") || h.startsWith("0.0.0.0");
}

function isBrandAppHost(h: string): boolean {
  for (const suffix of APP_BRAND_HOST_SUFFIXES) {
    if (h === suffix || h === `www.${suffix}`) return true;
  }
  return false;
}

/** Preview aliases on this request's Host header (not attacker x-forwarded-host). */
function isVercelPreviewHost(h: string): boolean {
  return h.endsWith(".vercel.app") && h !== "vercel.app" && !h.startsWith(".");
}

export function isAllowedAppHost(host: string): boolean {
  const h = stripHostPort(host);
  if (!h) return false;
  if (isLocalHostName(h)) return true;
  if (isBrandAppHost(h)) return true;
  if (vercelDeploymentHosts().has(h)) return true;
  return false;
}

export function resolveAppOrigin(input: {
  host?: string | null;
  forwardedHost?: string | null;
  proto?: string | null;
  fallback?: string | null;
}): string {
  const forwarded = (input.forwardedHost || "").split(",")[0].trim();
  const host = (input.host || "").split(",")[0].trim();
  // Trust x-forwarded-host only when it is a brand / localhost / this
  // deployment. Arbitrary *.vercel.app forwarded hosts are attacker-controlled.
  let raw = "";
  if (forwarded && isAllowedAppHost(forwarded)) {
    raw = forwarded;
  } else if (host && isAllowedAppHost(host)) {
    raw = host;
  } else if (host && isVercelPreviewHost(stripHostPort(host))) {
    raw = host;
  }

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
