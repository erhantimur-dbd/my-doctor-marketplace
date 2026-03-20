import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ClinicOnboardingWizard } from "./clinic-onboarding-wizard";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clinic Setup — MyDoctors360",
  robots: { index: false },
};

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function ClinicOnboardingPage({ params }: Props) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  // Fetch org + license + locations + members
  const { data: membership } = await supabase
    .from("organization_members")
    .select(`
      role,
      organization:organizations(
        id, name, slug, logo_url, description, cover_image_url,
        phone, email, website, onboarding_step, onboarding_completed_at,
        owner_role
      )
    `)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) redirect(`/${locale}/doctor-dashboard`);

  const org: any = Array.isArray(membership.organization)
    ? membership.organization[0]
    : membership.organization;

  // Only owner can complete onboarding
  if (membership.role !== "owner") {
    redirect(`/${locale}/doctor-dashboard`);
  }

  // Already completed
  if (org?.onboarding_completed_at) {
    redirect(`/${locale}/doctor-dashboard/organization`);
  }

  const { data: license } = await supabase
    .from("licenses")
    .select("tier, max_seats, used_seats, status")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: locations } = await supabase
    .from("clinic_locations")
    .select("*")
    .eq("organization_id", org.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  const { data: members } = await supabase
    .from("clinic_invitations")
    .select("id, email, role, status, created_at")
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  return (
    <ClinicOnboardingWizard
      org={org}
      license={license}
      locations={locations ?? []}
      invitations={members ?? []}
      currentStep={org?.onboarding_step ?? 0}
      locale={locale}
    />
  );
}
