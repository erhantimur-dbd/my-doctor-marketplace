export type SiteMode = "live" | "demo";

export function getSiteMode(): SiteMode {
  return process.env.NEXT_PUBLIC_SITE_MODE === "demo" ? "demo" : "live";
}

export function isDemoSite(): boolean {
  return getSiteMode() === "demo";
}
