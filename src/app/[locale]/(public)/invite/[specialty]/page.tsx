import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { generateMetadata as seoMeta } from "@/lib/seo/metadata";
import { getSpecialtyMeta } from "@/lib/constants/specialties";
import {
  getSpecialtyInvite,
  getSpecialtyInviteSlugs,
  isClinicInviteToken,
  isTestingSpecialtySlug,
} from "@/lib/constants/specialty-invites";
import { formatSpecialtyName } from "@/lib/utils";
import { SpecialtyInviteLanding } from "./specialty-invite-landing";
import {
  ClinicInvitePage,
  clinicInviteMetadata,
} from "./clinic-invite-page";

interface PageParams {
  params: Promise<{ locale: string; specialty: string }>;
}

export function generateStaticParams() {
  return getSpecialtyInviteSlugs().map((specialty) => ({ specialty }));
}

/** Clinic seat tokens remain reachable at /invite/[64-hex]. */
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: PageParams): Promise<Metadata> {
  const { locale, specialty } = await params;

  if (isTestingSpecialtySlug(specialty)) {
    return { title: "Not Found" };
  }

  const meta = getSpecialtyMeta(specialty);
  const copy = getSpecialtyInvite(specialty);
  if (meta && copy) {
    const name = formatSpecialtyName(meta.nameKey);
    return seoMeta({
      title: `${name} — Founding Doctor Invite`,
      description: copy.subhead,
      path: `/${locale}/invite/${specialty}`,
    });
  }

  if (isClinicInviteToken(specialty)) {
    return clinicInviteMetadata(specialty);
  }

  return { title: "Invite Not Found" };
}

export default async function SpecialtyInvitePage({ params }: PageParams) {
  const { locale, specialty } = await params;

  if (isTestingSpecialtySlug(specialty)) {
    notFound();
  }

  const copy = getSpecialtyInvite(specialty);
  if (copy) {
    return <SpecialtyInviteLanding slug={specialty} copy={copy} />;
  }

  if (isClinicInviteToken(specialty)) {
    return <ClinicInvitePage locale={locale} token={specialty} />;
  }

  notFound();
}
