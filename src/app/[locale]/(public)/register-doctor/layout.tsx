import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

// The page itself is a client component, so metadata lives in this layout.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  const seoMeta = (await import("@/lib/seo/metadata")).generateMetadata;
  return seoMeta({
    title: t("registerDoctor.title"),
    description: t("registerDoctor.description"),
    path: `/${locale}/register-doctor`,
  });
}

export default function RegisterDoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
