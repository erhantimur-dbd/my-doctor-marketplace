import { SupabaseClient } from "@supabase/supabase-js";

interface LicenseInfo {
  id: string;
  tier: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Get the active license for a doctor by looking up their organization.
 * Returns null if the doctor has no organization or no active license.
 */
export async function getDoctorLicense(
  supabase: SupabaseClient,
  doctorId: string
): Promise<LicenseInfo | null> {
  // Get doctor's organization_id
  const { data: doctor } = await supabase
    .from("doctors")
    .select("organization_id")
    .eq("id", doctorId)
    .single();

  if (!doctor?.organization_id) return null;

  const { data: license } = await supabase
    .from("licenses")
    .select(
      "id, tier, status, current_period_start, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_customer_id, metadata"
    )
    .eq("organization_id", doctor.organization_id)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return license as LicenseInfo | null;
}

/**
 * Check whether a doctor has any active license (active, trialing, or past_due).
 * Shortcut for cases where you only need a boolean check.
 */
export async function hasActiveLicense(
  supabase: SupabaseClient,
  doctorId: string
): Promise<boolean> {
  const license = await getDoctorLicense(supabase, doctorId);
  return !!license;
}

/**
 * Get the active license for an organization directly.
 * Useful when you already have the organization_id.
 */
export async function getOrgLicense(
  supabase: SupabaseClient,
  organizationId: string
): Promise<LicenseInfo | null> {
  const { data: license } = await supabase
    .from("licenses")
    .select(
      "id, tier, status, current_period_start, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_customer_id, metadata"
    )
    .eq("organization_id", organizationId)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return license as LicenseInfo | null;
}
