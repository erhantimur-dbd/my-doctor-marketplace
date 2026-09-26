"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { changeAnnualPlanPrice } from "@/actions/subscription-offers";

export function PriceForm() {
  const [planId, setPlanId] = useState("starter_annual");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        formData.set("plan_id", planId);
        startTransition(async () => {
          const result = await changeAnnualPlanPrice(formData);
          if (result.error) {
            setMessage(result.error);
            return;
          }
          const skipped = result.skipped?.length
            ? ` Skipped ${result.skipped.length} subscription(s).`
            : "";
          setMessage(
            `New price ${result.stripePriceId}. ${result.scheduled} subscription(s) scheduled onto it at renewal.${skipped}`
          );
        });
      }}
    >
      <div className="space-y-2">
        <Label>Plan</Label>
        <Select value={planId} onValueChange={setPlanId}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="starter_annual">Annual Solo</SelectItem>
            <SelectItem value="professional_annual">Annual Pro</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="amount">New annual price (pounds)</Label>
        <Input id="amount" name="amount_pounds" type="number" min={1} step="0.01" required />
        <p className="text-xs text-muted-foreground">
          Creates a new Stripe price. The old price is left unchanged. Existing annual subscribers move at a renewal that is at least 30 days away, and the notice email is driven from that schedule.
        </p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Updating…" : "Create new price"}
      </Button>
      {message ? <p className="text-sm">{message}</p> : null}
    </form>
  );
}
