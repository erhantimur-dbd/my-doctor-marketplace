import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveAuditSystemActor } from "@/lib/audit/system-actor";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUniqueLicenceConflict(
  error: { code?: string; message?: string } | null
): boolean {
  if (!error) return false;
  if (error.code === "23505") return true;
  return /idx_licenses_one_live_offer_per_org|duplicate key/i.test(error.message || "");
}

export function orphanedOfferAuditRow(
  actorId: string,
  via: string,
  input: {
    organizationId: string;
    subscriptionId: string;
    offerId: string;
    detail: string;
  }
) {
  return {
    actor_id: actorId,
    action: "offer_subscription_orphaned",
    target_type: "organization",
    target_id: input.organizationId,
    metadata: {
      actor_kind: "system",
      actor_resolution: via,
      source: "stripe_webhook",
      stripe_subscription_id: input.subscriptionId,
      offer_id: input.offerId,
      detail: input.detail,
      reason:
        "A live Stripe subscription could not be attached because this practice already has a live offer licence.",
    },
  };
}

/**
 * Same admin flag as credential auto-suspension: an `audit_log` row written
 * with the system actor, visible on the admin audit log.
 */
export async function flagOrphanedOfferSubscription(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    subscriptionId: string;
    offerId: string;
    detail: string;
  }
): Promise<void> {
  if (!UUID_RE.test(input.organizationId)) {
    console.error("Offer subscription orphaned but organization id is not a uuid", input);
    return;
  }
  const actor = await resolveAuditSystemActor(supabase);
  if (!actor) {
    console.error("Offer subscription orphaned and no admin actor to flag", input);
    return;
  }
  const { error } = await supabase
    .from("audit_log")
    .insert(orphanedOfferAuditRow(actor.actorId, actor.via, input));
  if (error) {
    console.error("Failed to flag orphaned offer subscription for admin", error);
  }
}
