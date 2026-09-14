import { createAdminClient } from "@/lib/supabase/admin";
import { routing } from "@/i18n/routing";
import { headers } from "next/headers";
import type { MetadataRoute } from "next";
import { regionFromHost } from "@/lib/region";

const { locales } = routing;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const host = (headersList.get("host") || "").replace(/:\d+$/, "");
  const protocol = host.includes("localhost") ? "http" : "https";
  const BASE_URL = host
    ? `${protocol}://${host}`
    : process.env.NEXT_PUBLIC_APP_URL || "https://www.mydoctors360.co.uk";
  const region = regionFromHost(host);
  const { isDemoSite } = await import("@/lib/site-mode");
  if (isDemoSite()) {
    return [];
  }

  // High-priority pages (homepage, search)
  const highPriorityPages = ["", "/doctors", "/specialties", "/conditions"];
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

  // Condition hub SEO pages — only slugs that resolve on /conditions/[slug]
  const { getAllConditionHubSlugs } = await import(
    "@/lib/constants/condition-hubs"
  );
  const conditionEntries = locales.flatMap((locale) =>
    getAllConditionHubSlugs().map((slug) => ({
      url: `${BASE_URL}/${locale}/conditions/${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.75,
    }))
  );

  // City × specialty programmatic SEO (UK/IE launch cities)
  const { UK_SEO_CITIES } = await import("@/lib/constants/uk-cities");
  const citySpecialtyEntries = locales.flatMap((locale) =>
    UK_SEO_CITIES.flatMap((city) =>
      (specialties || []).slice(0, 30).map((spec: { slug: string }) => ({
        url: `${BASE_URL}/${locale}/find/${city.slug}/${spec.slug}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      }))
    )
  );

  return [
    ...highPriorityEntries,
    ...publicEntries,
    ...legalEntries,
    ...ukOnlyEntries,
    ...doctorEntries,
    ...blogEntries,
    ...specialtyEntries,
    ...conditionEntries,
    ...citySpecialtyEntries,
  ];
}
