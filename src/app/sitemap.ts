import { createAdminClient } from "@/lib/supabase/admin";
import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mydoctor.com";
const locales = ["en", "de", "tr", "fr", "it", "es", "pt", "zh", "ja"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient();

  // Static pages
  const staticPages = ["", "/doctors", "/login", "/register", "/register-doctor"];
  const staticEntries = locales.flatMap((locale) =>
    staticPages.map((page) => ({
      url: `${BASE_URL}/${locale}${page}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: page === "" ? 1.0 : 0.8,
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

  return [...staticEntries, ...doctorEntries];
}
