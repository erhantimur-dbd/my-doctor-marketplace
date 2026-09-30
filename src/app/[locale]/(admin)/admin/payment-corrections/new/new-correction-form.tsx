"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPaymentCorrection } from "@/actions/payment-corrections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERROR_TYPES = [
  "duplicate_payout",
  "over_transfer",
  "double_refund",
  "platform_fee",
  "wrong_account",
  "patient_overcharge",
  "patient_credit_in_error",
  "founding_payment",
  "other",
  "fraud",
];

export function NewCorrectionForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          const result = await createPaymentCorrection(formData);
          if ("error" in result && result.error) {
            setError(result.error);
            return;
          }
          if (!("id" in result) || !result.id) {
            setError("Could not create the correction");
            return;
          }
          router.push(`/admin/payment-corrections/${result.id}`);
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>Party</span>
          <select name="party" className="w-full rounded-md border px-3 py-2" required>
            <option value="patient">Patient</option>
            <option value="doctor">Doctor</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Direction</span>
          <select name="direction" className="w-full rounded-md border px-3 py-2" required>
            <option value="customer_favour">Customer favour</option>
            <option value="platform_favour">Platform favour</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Amount (cents)</span>
          <Input name="amount_cents" type="number" min={1} required />
        </label>
        <label className="space-y-1 text-sm">
          <span>Currency</span>
          <Input name="currency" defaultValue="GBP" maxLength={3} required />
        </label>
        <label className="space-y-1 text-sm">
          <span>Error type</span>
          <select name="error_type" className="w-full rounded-md border px-3 py-2" required>
            {ERROR_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>Required approvals</span>
          <Input name="required_approvals" type="number" min={1} defaultValue={1} />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span>Related payment at</span>
          <Input name="related_payment_at" type="datetime-local" />
        </label>
      </div>
      <label className="block space-y-1 text-sm">
        <span>Reason</span>
        <Input name="reason" required />
      </label>
      <label className="block space-y-1 text-sm">
        <span>Statement line</span>
        <Input name="statement_line" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          "patient_id",
          "doctor_id",
          "booking_id",
          "license_id",
          "stripe_charge_id",
          "stripe_payment_intent_id",
          "stripe_transfer_id",
          "stripe_refund_id",
          "stripe_payout_id",
          "stripe_invoice_id",
          "stripe_subscription_id",
        ].map((name) => (
          <label key={name} className="space-y-1 text-sm">
            <span>{name}</span>
            <Input name={name} />
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="our_error" value="true" />
        This failure was our error
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Flag correction"}
      </Button>
      <Label className="sr-only">Payment correction</Label>
    </form>
  );
}
