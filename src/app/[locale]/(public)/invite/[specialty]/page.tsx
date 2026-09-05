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
import { SpecialtyInviteLanding } from "./specialty-invite-landing";

interface PageParams {
  params: Promise<{ locale: string; specialty: string }>;
}

export function generateStaticParams() {
  return getSpecialtyInviteSlugs().map((specialty) => ({ specialty }));
}

/** Unknown / testing slugs 404. Clinic seat tokens are rewritten in middleware to /invite/accept/[token]. */
export const dynamicParams = false;

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
