import type { CheckoutOffer } from "@/lib/offers/validation";

export type OfferCheckoutFields = {
  mode: "subscription";
  payment_method_collection: "always";
  /**
   * Stripe rejects `allow_promotion_codes` together with `discounts`.
   * Trial offers set it false. Percent offers pass `discounts` only,
   * which removes the promotion-code box. Server validation rejects a
   * second code in both cases.
   */
  allow_promotion_codes?: false;
  discounts?: { promotion_code: string }[];
  line_items: { price: string; quantity: number }[];
  metadata: Record<string, string>;
  subscription_data: {
    trial_period_days?: number;
    metadata: Record<string, string>;
  };
};

export function buildOfferCheckoutFields(input: {
  offer: CheckoutOffer;
  priceId: string;
  organizationId: string;
  doctorId: string;
  tier: string;
  planId: string;
  inviteId: string;
  specialtySlug: string;
  seatCount: string;
  maxSeats: string;
}): OfferCheckoutFields {
  const metadata: Record<string, string> = {
    organization_id: input.organizationId,
    doctor_id: input.doctorId,
    tier: input.tier,
    type: "license",
    billing_period: "annual",
    seat_count: input.seatCount,
    max_seats: input.maxSeats,
    has_testing_addon: "0",
    offer_id: input.offer.id,
    offer_invite_id: input.inviteId,
    attribution_specialty: input.specialtySlug,
    plan_id: input.planId,
  };

  const fields: OfferCheckoutFields = {
    mode: "subscription",
    payment_method_collection: "always",
    line_items: [{ price: input.priceId, quantity: 1 }],
    metadata,
    subscription_data: { metadata: { ...metadata } },
  };

  if (input.offer.kind === "free_trial") {
    fields.allow_promotion_codes = false;
    fields.subscription_data.trial_period_days = input.offer.trialDays ?? undefined;
    return fields;
  }

  if (input.offer.stripePromotionCodeId) {
    fields.discounts = [{ promotion_code: input.offer.stripePromotionCodeId }];
  }
  return fields;
}
