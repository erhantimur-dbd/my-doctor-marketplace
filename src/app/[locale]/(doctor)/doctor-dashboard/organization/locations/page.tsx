import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LocationsClient } from "./locations-client";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Manage Locations — MyDoctors360" };

interface Props { params: Promise<{ locale: string }> }

export default async function OrganizationLocationsPage({ params }: Props) {
  const { locale } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/${locale}/login`);

  const { data: membership } = await supabase
    .from("organization_members")
    .select("role, organization_id, organization:organizations(id, name)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    redirect(`/${locale}/doctor-dashboard/organization`);
  }

  const org: any = Array.isArray(membership.organization)
    ? membership.organization[0]
    : membership.organization;

  // Fetch locations
  const { data: locations } = await supabase
    .from("clinic_locations")
    .select("*")
    .eq("organization_id", org.id)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  // Fetch doctors in this org with their location assignments
  const { data: orgDoctors } = await supabase
    .from("organization_members")
    .select(`
      user_id,
      doctor:doctors(
        id, slug, consultation_fee_cents,
        profile:profiles(first_name, last_name, avatar_url)
      )
    `)
    .eq("organization_id", org.id)
    .eq("status", "active")
    .eq("role", "doctor");

  // Fetch existing assignments
  const { data: assignments } = await supabase
    .from("doctor_location_assignments")
    .select("doctor_id, clinic_location_id, is_active")
    .eq("organization_id", org.id)
    .eq("is_active", true);

  return (
    <LocationsClient
      org={org}
      locations={locations ?? []}
      orgDoctors={orgDoctors ?? []}
      assignments={assignments ?? []}
      locale={locale}
    />
  );
}
