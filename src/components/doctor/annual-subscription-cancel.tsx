"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cancelAnnualOrTrialSubscription } from "@/actions/subscription-cancel";
import { formatOfferDate } from "@/lib/offers/dates";
import { decideSubscriptionCancel } from "@/lib/offers/cancel";

type LicenseCancelProps = {
  tier: string | null;
  status: string | null;
  billingPeriod: string | null;
  offerId: string | null;
  trialEndsAt: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export function AnnualSubscriptionCancel(props: LicenseCancelProps) {
  const decision = decideSubscriptionCancel({
    tier: props.tier,
    status: props.status,
    billingPeriod: props.billingPeriod,
    offerId: props.offerId,
    trialEndsAt: props.trialEndsAt,
    periodEnd: props.periodEnd,
    cancelAtPeriodEnd: props.cancelAtPeriodEnd,
  });
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  if (decision.action === "unchanged") return null;

  const endLabel = formatOfferDate(new Date(decision.accessEndsAt));

  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <p className="font-semibold">Cancel subscription</p>
        {decision.action === "cancel_at_trial_end" ? (
          <p className="text-sm text-muted-foreground">
            You won&apos;t be charged. Access ends on <strong>{endLabel}</strong>.
          </p>
        ) : null}
        {decision.action === "cancel_at_period_end" ? (
          <p className="text-sm text-muted-foreground">
            No refund. Access continues until <strong>{endLabel}</strong>, then ends. It will not renew.
          </p>
        ) : null}
        {decision.action === "already_ending" ? (
          <p className="text-sm text-muted-foreground">
            Already set to end on <strong>{endLabel}</strong>.
          </p>
        ) : null}
        {decision.action !== "already_ending" ? (
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await cancelAnnualOrTrialSubscription();
                setMessage(result.error || result.message || "");
              });
            }}
          >
            {pending ? "Cancelling…" : "Cancel renewal"}
          </Button>
        ) : null}
        {message ? <p className="text-sm">{message}</p> : null}
      </CardContent>
    </Card>
  );
}
