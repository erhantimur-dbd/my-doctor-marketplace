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

  const { data: licenses } = await supabase
    .from("licenses")
    .select(
      "id, tier, status, current_period_start, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_customer_id, metadata, created_at"
    )
    .eq("organization_id", doctor.organization_id)
    .in("status", ["active", "trialing", "past_due"]);

  const { pickEffectiveLicense } = await import("@/lib/license/tier-lifecycle");
  return pickEffectiveLicense(
    (licenses || []) as (LicenseInfo & { created_at?: string })[]
  ) as LicenseInfo | null;
}

/**
 * True when the doctor has an active **paid** licence (Starter+).
 * Founding Free is active but listing-only — must return false so dashboard
 * gates do not treat free as subscribed.
 */
export async function hasActiveLicense(
  supabase: SupabaseClient,
  doctorId: string
): Promise<boolean> {
  const license = await getDoctorLicense(supabase, doctorId);
  if (!license) return false;
  const { isPaidTier, isActiveLicenseStatus } = await import(
    "@/lib/license/tier-lifecycle"
  );
  return (
    isPaidTier(license.tier) && isActiveLicenseStatus(license.status)
  );
}

/**
 * Effective licence tier for a doctor (free / starter / …), or null.
 */
export async function getDoctorLicenseTier(
  supabase: SupabaseClient,
  doctorId: string
): Promise<string | null> {
  const license = await getDoctorLicense(supabase, doctorId);
  return license?.tier ?? null;
}

/**
 * Pro+ tiers that include patient waitlist auto-notify (availability alerts).
 * Starter/free do not get the auto-notify product feature.
 */
export function doctorTierHasWaitlistAutoNotify(
  tier: string | null | undefined
): boolean {
  if (!tier) return false;
  return (
    tier === "professional" ||
    tier === "clinic" ||
    tier === "enterprise"
  );
}

/**
 * True when the doctor's org license includes waitlist auto-notify.
 */
export async function doctorHasWaitlistAutoNotify(
  supabase: SupabaseClient,
  doctorId: string
): Promise<boolean> {
  const license = await getDoctorLicense(supabase, doctorId);
  if (!license) return false;
  return doctorTierHasWaitlistAutoNotify(license.tier);
}

/**
 * Get the active license for an organization directly.
 * Useful when you already have the organization_id.
 */
export async function getOrgLicense(
  supabase: SupabaseClient,
  organizationId: string
): Promise<LicenseInfo | null> {
  const { data: licenses } = await supabase
    .from("licenses")
    .select(
      "id, tier, status, current_period_start, current_period_end, cancel_at_period_end, stripe_subscription_id, stripe_customer_id, metadata, created_at"
    )
    .eq("organization_id", organizationId)
    .in("status", ["active", "trialing", "past_due"]);

  const { pickEffectiveLicense } = await import("@/lib/license/tier-lifecycle");
  return pickEffectiveLicense(
    (licenses || []) as (LicenseInfo & { created_at?: string })[]
  ) as LicenseInfo | null;
}
