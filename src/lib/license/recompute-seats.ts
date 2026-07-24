import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeUsedSeatsFromMembers,
} from "@/lib/license/seats";
import { pickEffectiveLicense } from "@/lib/license/tier-lifecycle";

/** Sync licenses.used_seats from active doctor/owner members (source of truth). */
export async function recomputeOrgUsedSeats(
  adminSupabase: SupabaseClient,
  organizationId: string
): Promise<number> {
  const { data: members } = await adminSupabase
    .from("organization_members")
    .select("role, status")
    .eq("organization_id", organizationId);

  const used = computeUsedSeatsFromMembers(members || []);

  const { data: licenses } = await adminSupabase
    .from("licenses")
    .select("id, tier, status, created_at")
    .eq("organization_id", organizationId);

  const license = pickEffectiveLicense(licenses || []);
  if (license?.id) {
    await adminSupabase
      .from("licenses")
      .update({ used_seats: used })
      .eq("id", license.id);
  }
  return used;
}
