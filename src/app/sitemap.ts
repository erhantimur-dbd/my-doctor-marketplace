import { createAdminClient } from "@/lib/supabase/admin";
import { routing } from "@/i18n/routing";
import { headers } from "next/headers";
import type { MetadataRoute } from "next";

const { locales } = routing;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const protocol = host.includes("localhost") ? "http" : "https";
  const BASE_URL = host ? `${protocol}://${host}` : (process.env.NEXT_PUBLIC_APP_URL || "https://www.mydoctors360.co.uk");

  const supabase = createAdminClient();

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
  const legalPages = ["/terms", "/privacy", "/cookie-policy"];
  const legalEntries = locales.flatMap((locale) =>
    legalPages.map((page) => ({
      url: `${BASE_URL}/${locale}${page}`,
      lastModified: new Date(),
      changeFrequency: "monthly" as const,
      priority: 0.3,
    }))
  );

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
    ...doctorEntries,
    ...blogEntries,
    ...specialtyEntries,
  ];
}
