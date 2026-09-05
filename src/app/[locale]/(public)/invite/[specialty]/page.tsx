import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { generateMetadata as seoMeta } from "@/lib/seo/metadata";
import { getSpecialtyMeta } from "@/lib/constants/specialties";
import {
  getSpecialtyInvite,
  getSpecialtyInviteSlugs,
  isTestingSpecialtySlug,
} from "@/lib/constants/specialty-invites";
import { formatSpecialtyName } from "@/lib/utils";
import { routing } from "@/i18n/routing";
import { SpecialtyInviteLanding } from "./specialty-invite-landing";

interface PageParams {
  params: Promise<{ locale: string; specialty: string }>;
}

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    getSpecialtyInviteSlugs().map((specialty) => ({ locale, specialty }))
  );
}

/**
 * Parent [locale] layout reads auth cookies via Supabase.
 * generateStaticParams + dynamicParams=false 404s every medical slug on
 * Preview (paths never SSG) and can throw DYNAMIC_SERVER_USAGE on siblings
 * such as /pricing — same class of bug as conditions/[slug].
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { locale, specialty } = await params;

  if (isTestingSpecialtySlug(specialty)) {
    return { title: "Not Found" };
  }

  const meta = getSpecialtyMeta(specialty);
  const copy = getSpecialtyInvite(specialty);
  if (!meta || !copy) {
    return { title: "Invite Not Found" };
  }

  const name = formatSpecialtyName(meta.nameKey);
  return seoMeta({
    title: `${name} — Founding Doctor Invite`,
    description: copy.subhead,
    path: `/${locale}/invite/${specialty}`,
  });
}

export default async function SpecialtyInvitePage({ params }: PageParams) {
  const { specialty } = await params;

  if (isTestingSpecialtySlug(specialty)) {
    notFound();
  }

  const copy = getSpecialtyInvite(specialty);
  if (!copy) {
    notFound();
  }

  return <SpecialtyInviteLanding slug={specialty} copy={copy} />;
}
