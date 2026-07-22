import { createAdminClient } from "@/lib/supabase/admin";
import { routing } from "@/i18n/routing";
import { headers } from "next/headers";
import type { MetadataRoute } from "next";
import { regionFromHost } from "@/lib/region";

const { locales } = routing;

/** Hosts that still serve the coming-soon gate for most patient paths. */
const COMING_SOON_HOSTS = new Set([
  "mydoctors360.com",
  "www.mydoctors360.com",
  "mydoctors360.co.uk",
  "www.mydoctors360.co.uk",
  "mydoctors360.eu",
  "www.mydoctors360.eu",
]);

/**
 * Public paths allowed through the coming-soon gate (must stay in sync with
 * middleware.ts COMING_SOON_ALLOWED_PREFIXES and vercel.json rewrites).
 * Only these are listed in the sitemap while the gate is active so crawlers
 * are not fed URLs that rewrite to founding-doctor HTML.
 */
const SOFT_LAUNCH_PUBLIC_PAGES = [
  // Soft-launch: no patient home/search until go-live
  "/pricing",
  "/how-it-works",
  "/contact",
  "/help-center",
  "/terms",
  "/privacy",
  "/cookie-policy",
  "/about",
  "/login",
  "/register",
  "/register-doctor",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const host = (headersList.get("host") || "").replace(/:\d+$/, "");
  const protocol = host.includes("localhost") ? "http" : "https";
  const BASE_URL = host
    ? `${protocol}://${host}`
    : process.env.NEXT_PUBLIC_APP_URL || "https://www.mydoctors360.co.uk";
  const region = regionFromHost(host);
  const softLaunch = COMING_SOON_HOSTS.has(host);

  // While the coming-soon gate is active on production hosts, only emit URLs
  // that actually return the app (doctor soft-launch allowlist). Full patient
  // sitemap (home, doctors, blog, specialties) returns after gate lift.
  if (softLaunch) {
    const softEntries = locales.flatMap((locale) =>
      SOFT_LAUNCH_PUBLIC_PAGES.map((page) => ({
        url: `${BASE_URL}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority:
          page === "/register-doctor" || page === "/pricing" ? 0.9 : 0.6,
      }))
    );

    const ukOnlyPages = region === "uk" ? ["/regulatory", "/complaints"] : [];
    const ukOnlyEntries = locales.flatMap((locale) =>
      ukOnlyPages.map((page) => ({
        url: `${BASE_URL}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: "monthly" as const,
        priority: 0.3,
      }))
    );

    return [...softEntries, ...ukOnlyEntries];
  }

  // High-priority pages (homepage, search)
  const highPriorityPages = ["", "/doctors", "/specialties"];
  const highPriorityEntries = locales.flatMap((locale) =>
    highPriorityPages.map((page) => ({
      url: `${BASE_URL}/${locale}${page}`,
      lastModified: new Date(),
      changeFrequency: "daily" as const,
      priority: page === "" ? 1.0 : 0.9,
    }))
  );

  // Standard public pages
  const publicPages = [
    "/how-it-works",
    "/pricing",
    "/blog",
    "/contact",
    "/help-center",
    "/support",
    "/rewards",
    "/find-pharmacy",
    "/login",
    "/register",
    "/register-doctor",
  ];
  const publicEntries = locales.flatMap((locale) =>
    publicPages.map((page) => ({
      url: `${BASE_URL}/${locale}${page}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))
  );

  // Legal pages (lower priority, rarely change)
  const legalPages = ["/terms", "/privacy", "/cookie-policy", "/about"];
  const legalEntries = locales.flatMap((locale) =>
    legalPages.map((page) => ({
      url: `${BASE_URL}/${locale}${page}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    }))
  );

  // UK-only pages. These routes return 404 on non-UK regions, so we only
  // emit them in the sitemap when the request came in on the .co.uk host.
  const ukOnlyPages = region === "uk" ? ["/regulatory", "/complaints"] : [];
  const ukOnlyEntries = locales.flatMap((locale) =>
    ukOnlyPages.map((page) => ({
      url: `${BASE_URL}/${locale}${page}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    }))
  );

  const supabase = createAdminClient();

  // Dynamic doctor profile pages
  const { data: doctors } = await supabase
    .from("doctors")
    .select("slug, updated_at")
    .eq("is_active", true)
    .eq("verification_status", "verified");

  const doctorEntries = locales.flatMap((locale) =>
    (doctors || []).map((doctor) => ({
      url: `${BASE_URL}/${locale}/doctors/${doctor.slug}`,
      lastModified: new Date(doctor.updated_at),
      changeFrequency: "daily" as const,
      priority: 0.9,
    }))
  );

  // Dynamic blog posts
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("slug, updated_at")
    .eq("status", "published");

  const blogEntries = locales.flatMap((locale) =>
    (posts || []).map((post) => ({
      url: `${BASE_URL}/${locale}/blog/${post.slug}`,
      lastModified: new Date(post.updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }))
  );

  // Dynamic specialty pages
  const { data: specialties } = await supabase
    .from("specialties")
    .select("slug");

  const specialtyEntries = locales.flatMap((locale) =>
    (specialties || []).map((spec) => ({
      url: `${BASE_URL}/${locale}/specialties/${spec.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }))
  );

  return [
    ...highPriorityEntries,
    ...publicEntries,
    ...legalEntries,
    ...ukOnlyEntries,
    ...doctorEntries,
    ...blogEntries,
    ...specialtyEntries,
  ];
}
