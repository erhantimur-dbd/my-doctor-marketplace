export type CancelDecision =
  | {
      action: "cancel_at_trial_end";
      accessEndsAt: string;
      refund: false;
    }
  | {
      action: "cancel_at_period_end";
      accessEndsAt: string;
      refund: false;
    }
  | {
      action: "already_ending";
      accessEndsAt: string;
    }
  | { action: "unchanged"; reason: string };

export type StripeCancelParams =
  | { cancel_at: number; proration_behavior: "none" }
  | { cancel_at_period_end: true; proration_behavior: "none" };

/**
 * Offer trial: end at the trial boundary, no invoice, no refund.
 * Paid offer year: cancel_at_period_end, no refund, access until period end.
 * Monthly, Founding Free, and annual plans without an offer stay on the
 * existing billing path.
 */
export function decideSubscriptionCancel(input: {
  tier: string | null;
  status: string | null;
  billingPeriod: string | null;
  offerId: string | null;
  trialEndsAt: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}): CancelDecision {
  if (!input.offerId) {
    return {
      action: "unchanged",
      reason: "Only an offer subscription can be cancelled here.",
    };
  }
  if (!input.status || input.tier === "free") {
    return {
      action: "unchanged",
      reason: "Monthly plans and Founding Free keep their current billing path.",
    };
  }

  const periodEnd = input.periodEnd;
  const trialEnd = input.trialEndsAt || periodEnd;

  if (input.status === "trialing") {
    if (!trialEnd) {
      return { action: "unchanged", reason: "Trial end date is missing." };
    }
    if (input.cancelAtPeriodEnd) {
      return { action: "already_ending", accessEndsAt: trialEnd };
    }
    return {
      action: "cancel_at_trial_end",
      accessEndsAt: trialEnd,
      refund: false,
    };
  }

  if (input.billingPeriod !== "annual") {
    return {
      action: "unchanged",
      reason: "Monthly plans keep their current billing path.",
    };
  }

  if (input.status !== "active" && input.status !== "past_due") {
    return {
      action: "unchanged",
      reason: "This subscription can't be cancelled from here.",
    };
  }
  if (!periodEnd) {
    return { action: "unchanged", reason: "Renewal date is missing." };
  }
  if (input.cancelAtPeriodEnd) {
    return { action: "already_ending", accessEndsAt: periodEnd };
  }
  return {
    action: "cancel_at_period_end",
    accessEndsAt: periodEnd,
    refund: false,
  };
}

export function stripeCancelParams(
  decision: CancelDecision
): StripeCancelParams | null {
  if (decision.action === "cancel_at_trial_end") {
    return {
      cancel_at: Math.floor(new Date(decision.accessEndsAt).getTime() / 1000),
      proration_behavior: "none",
    };
  }
  if (decision.action === "cancel_at_period_end") {
    return { cancel_at_period_end: true, proration_behavior: "none" };
  }
  return null;
}
