import type Stripe from "stripe";
import { noticeDueAt, priceSwitchAt } from "@/lib/offers/dates";
import { assertStripeTestMode } from "@/lib/offers/stripe-mode";

function priceIdOf(price: string | { id: string }): string {
  return typeof price === "string" ? price : price.id;
}

export async function createPercentOffCouponAndCode(
  stripe: Stripe,
  input: { name: string; percentOff: number; redeemBy: Date; offerSlug: string }
): Promise<{ couponId: string; promotionCodeId: string }> {
  assertStripeTestMode();
  const coupon = await stripe.coupons.create({
    percent_off: input.percentOff,
    duration: "once",
    name: input.name.slice(0, 40),
    metadata: {
      md360_offer: "1",
      md360_offer_slug: input.offerSlug,
      kind: "percent_first_year",
    },
  });
  const promotion = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    expires_at: Math.floor(input.redeemBy.getTime() / 1000),
    metadata: {
      md360_offer: "1",
      md360_offer_slug: input.offerSlug,
    },
  });
  return { couponId: coupon.id, promotionCodeId: promotion.id };
}

export async function deactivatePromotionCode(
  stripe: Stripe,
  promotionCodeId: string
): Promise<void> {
  assertStripeTestMode();
  await stripe.promotionCodes.update(promotionCodeId, { active: false });
}

export async function createAnnualPrice(
  stripe: Stripe,
  input: { productId: string; amountPence: number; planId: string }
): Promise<Stripe.Price> {
  assertStripeTestMode();
  return stripe.prices.create({
    product: input.productId,
    unit_amount: input.amountPence,
    currency: "gbp",
    recurring: { interval: "year" },
    metadata: {
      md360_plan: input.planId,
      billing_period: "annual",
    },
  });
}

function periodEndUnix(subscription: Stripe.Subscription): number | null {
  const raw = subscription as unknown as { current_period_end?: number };
  if (typeof raw.current_period_end === "number") return raw.current_period_end;
  const item = subscription.items?.data?.[0] as { current_period_end?: number } | undefined;
  return typeof item?.current_period_end === "number" ? item.current_period_end : null;
}

export type ScheduledSwitch = {
  scheduleId: string;
  subscriptionId: string;
  switchAt: Date;
  noticeDueAt: Date;
};

/**
 * Moves one annual subscription onto `newPriceId` at a renewal that is at
 * least 30 days away. The current price is not edited.
 */
export async function scheduleAnnualPriceSwitch(
  stripe: Stripe,
  input: {
    subscription: Stripe.Subscription;
    oldPriceId: string;
    newPriceId: string;
    now: Date;
  }
): Promise<ScheduledSwitch> {
  assertStripeTestMode();
  const periodEndUnixValue = periodEndUnix(input.subscription);
  if (!periodEndUnixValue) {
    throw new Error("Subscription has no renewal date.");
  }
  const switchAt = priceSwitchAt(new Date(periodEndUnixValue * 1000), input.now);
  const switchUnix = Math.floor(switchAt.getTime() / 1000);

  const existingId =
    typeof input.subscription.schedule === "string"
      ? input.subscription.schedule
      : input.subscription.schedule?.id;

  const schedule = existingId
    ? await stripe.subscriptionSchedules.retrieve(existingId)
    : await stripe.subscriptionSchedules.create({
        from_subscription: input.subscription.id,
      });

  const current = schedule.phases[0];
  if (!current) throw new Error("Subscription schedule has no current phase.");

  const phaseItems = current.items.map((item) => {
    const id = priceIdOf(item.price as string | { id: string });
    return {
      price: id === input.oldPriceId ? input.oldPriceId : id,
      quantity: item.quantity ?? 1,
    };
  });
  const nextItems = phaseItems.map((item) => ({
    price: item.price === input.oldPriceId ? input.newPriceId : item.price,
    quantity: item.quantity,
  }));

  const updated = await stripe.subscriptionSchedules.update(schedule.id, {
    end_behavior: "release",
    proration_behavior: "none",
    phases: [
      {
        items: phaseItems,
        start_date: current.start_date,
        end_date: switchUnix,
        proration_behavior: "none",
      },
      {
        items: nextItems,
        proration_behavior: "none",
      },
    ],
  });

  return {
    scheduleId: updated.id,
    subscriptionId: input.subscription.id,
    switchAt,
    noticeDueAt: noticeDueAt(switchAt),
  };
}

export async function listAnnualSubscriptionsOnPrice(
  stripe: Stripe,
  priceId: string
): Promise<Stripe.Subscription[]> {
  assertStripeTestMode();
  const found: Stripe.Subscription[] = [];
  for (const status of ["active", "trialing"] as const) {
    for await (const subscription of stripe.subscriptions.list({
      price: priceId,
      status,
      limit: 100,
    })) {
      const billing = subscription.metadata?.billing_period;
      if (billing === "monthly") continue;
      const interval = subscription.items?.data?.[0]?.price?.recurring?.interval;
      if (interval && interval !== "year") continue;
      found.push(subscription);
    }
  }
  return found;
}
