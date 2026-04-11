import { headers } from "next/headers";

/**
 * Region selector for content variants.
 *
 * Drives which variant of region-aware content (terms, privacy, regulatory,
 * complaints, about, etc.) is rendered. The UK variant is used for CQC-aware
 * UK legal posture; the default variant is the existing cross-region content
 * served on `.com`, `.eu`, and anywhere else.
 *
 * Regions are detected from the incoming `Host` header. Localhost and preview
 * deployments default to `com` unless overridden via the `X-Preview-Region`
 * header or a `?region=` query string — see {@link resolveRegionFromRequest}.
 */
export type Region = "uk" | "eu" | "com";

const UK_HOST_SUFFIX = "mydoctors360.co.uk";
const EU_HOST_SUFFIX = "mydoctors360.eu";

/**
 * Resolve the region from a Host header string. Exported for unit testing and
 * for callers that already have the host in hand (e.g. middleware).
 */
export function regionFromHost(host: string | null | undefined): Region {
  if (!host) return "com";
  const normalised = host.toLowerCase().replace(/:\d+$/, "");
  if (normalised.endsWith(UK_HOST_SUFFIX)) return "uk";
  if (normalised.endsWith(EU_HOST_SUFFIX)) return "eu";
  return "com";
}

/**
 * Server-component helper: returns the region for the current request.
 *
 * Uses the same `headers()` + `host` pattern already in use by
 * `src/app/sitemap.ts` and `src/app/robots.ts`.
 *
 * Honours a preview override so engineers can render UK content from
 * localhost: set `X-Preview-Region: uk` (or `eu`, or `com`) on the request.
 * The override is accepted on non-production hosts only — production traffic
 * is always decided by the real Host header.
 */
export async function getRegion(): Promise<Region> {
  const h = await headers();
  const host = h.get("host");

  // Preview override (non-production only). Production is decided strictly by
  // the Host header so no client can force a UK render on a non-UK domain.
  const isProduction =
    host?.endsWith(UK_HOST_SUFFIX) || host?.endsWith(EU_HOST_SUFFIX) || host === "mydoctors360.com" || host === "www.mydoctors360.com";
  if (!isProduction) {
    const override = h.get("x-preview-region")?.toLowerCase();
    if (override === "uk" || override === "eu" || override === "com") {
      return override;
    }
  }

  return regionFromHost(host);
}

/**
 * Convenience helper for `notFound()`-based route gating. Use this in the
 * `page.tsx` of a UK-only route:
 *
 * ```tsx
 * export default async function RegulatoryPage() {
 *   if (!(await isRegion("uk"))) notFound();
 *   return <RegulatoryUk />;
 * }
 * ```
 */
export async function isRegion(region: Region): Promise<boolean> {
  return (await getRegion()) === region;
}
