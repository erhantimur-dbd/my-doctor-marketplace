"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSubscriptionOffer, deactivateSubscriptionOffer } from "@/actions/subscription-offers";

export function OfferBuilder() {
  const [kind, setKind] = useState("percent_first_year");
  const [plans, setPlans] = useState<string[]>(["starter_annual", "professional_annual"]);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  function togglePlan(id: string, checked: boolean) {
    setPlans((current) =>
      checked ? Array.from(new Set([...current, id])) : current.filter((plan) => plan !== id)
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        for (const plan of plans) formData.append("eligible_plans", plan);
        formData.set("kind", kind);
        startTransition(async () => {
          const result = await createSubscriptionOffer(formData);
          setMessage(result.error || "Offer saved. Stripe test objects were created for discounts.");
        });
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="offer-name">Name</Label>
        <Input id="offer-name" name="name" required placeholder="50% off first year" />
      </div>
      <div className="space-y-2">
        <Label>Kind</Label>
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="percent_first_year">Percent off first year</SelectItem>
            <SelectItem value="free_trial">Free trial</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {kind === "percent_first_year" ? (
        <div className="space-y-2">
          <Label htmlFor="percent-off">Percent off</Label>
          <Input id="percent-off" name="percent_off" type="number" min={1} max={100} required />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="trial-days">Trial days</Label>
          <Input id="trial-days" name="trial_days" type="number" min={1} max={365} required />
        </div>
      )}
      <div className="space-y-2">
        <Label>Eligible annual plans</Label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={plans.includes("starter_annual")}
            onCheckedChange={(checked) => togglePlan("starter_annual", checked === true)}
          />
          Solo
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={plans.includes("professional_annual")}
            onCheckedChange={(checked) => togglePlan("professional_annual", checked === true)}
          />
          Pro
        </label>
      </div>
      <div className="space-y-2">
        <Label htmlFor="redeem-by">Redeem by</Label>
        <Input id="redeem-by" name="redeem_by" type="date" required />
        <p className="text-xs text-muted-foreground">End of that day, Europe/London.</p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Create offer"}
      </Button>
      {message ? <p className="text-sm">{message}</p> : null}
    </form>
  );
}

export function DeactivateOfferButton({ offerId }: { offerId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData();
        formData.set("offer_id", offerId);
        startTransition(async () => {
          const result = await deactivateSubscriptionOffer(formData);
          setMessage(result.error || "Switched off.");
        });
      }}
    >
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        Switch off
      </Button>
      {message ? <p className="mt-1 text-xs">{message}</p> : null}
    </form>
  );
}
