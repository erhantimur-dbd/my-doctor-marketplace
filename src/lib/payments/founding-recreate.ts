import { getStripe } from "@/lib/stripe/client";
import { getLicenseTier, getOrCreateLicensePriceId } from "@/lib/constants/license-tiers";
import { foundingCheckoutMetadata } from "@/lib/founding/offer";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Recreate a deleted £99 founding subscription for a doctor who already
 * holds a founding number. Does not claim a spot and does not change the cap.
 */
export async function recreateFoundingSubscription(input: {
  correctionId: string;
  doctorId: string;
  organizationId: string;
  customerId: string;
}): Promise<{ subscriptionId: string }> {
  const admin = createAdminClient();
  const { data: doctor, error } = await admin
    .from("doctors")
    .select("id, founding_member_number")
    .eq("id", input.doctorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!doctor?.founding_member_number) {
    throw new Error("This doctor has no founding place to keep");
  }

  await admin
    .from("doctors")
    .update({ founding_offer_forfeited_at: null })
    .eq("id", input.doctorId);

  const tier = getLicenseTier("founding");
  if (!tier) throw new Error("Founding tier is not configured");
  const priceId = await getOrCreateLicensePriceId("founding", tier, "monthly");
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.create(
    {
      customer: input.customerId,
      items: [{ price: priceId, quantity: 1 }],
      metadata: {
        organization_id: input.organizationId,
        doctor_id: input.doctorId,
        tier: "founding",
        type: "license",
        billing_period: "monthly",
        seat_count: "1",
        max_seats: "1",
        payment_correction_id: input.correctionId,
        founding_recreate: "1",
        ...foundingCheckoutMetadata(),
      },
    },
    {
      idempotencyKey: `payment-correction-founding-recreate-${input.correctionId}`,
    }
  );
  return { subscriptionId: subscription.id };
}
