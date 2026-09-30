"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  approvePaymentCorrection,
  escalateDoctorDispute,
  markOffsetUncollectible,
  openDispute,
  recordCustomerResponse,
  recordPatientConsent,
  recreateFoundingFromCorrection,
  resolveDispute,
  runFavourableCorrection,
  runTransferReversal,
  runWalletDebit,
  sendCorrectionNotice,
  sendDirectRequest,
  setClearRisk,
  setOurErrorFlag,
  settleCorrection,
  startPayoutOffset,
  waiveCorrection,
} from "@/actions/payment-corrections";

export function CorrectionActions({
  correctionId,
  party,
  ourError,
  errorType,
}: {
  correctionId: string;
  party: string;
  ourError: boolean;
  errorType: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(task: () => Promise<{ error?: string | null } | { ok: true }>) {
    startTransition(async () => {
      const result = await task();
      setMessage("error" in result && result.error ? result.error : "Saved");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={pending}
          onClick={() => run(() => approvePaymentCorrection(correctionId))}
        >
          Approve
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => sendCorrectionNotice(correctionId))}
        >
          Send notice
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => startPayoutOffset(correctionId))}
        >
          Start offset
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => sendDirectRequest(correctionId))}
        >
          Direct request
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => runFavourableCorrection(correctionId))}
        >
          Customer-favour repayment
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => runWalletDebit(correctionId))}
        >
          Wallet debit
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => settleCorrection(correctionId))}
        >
          Settle
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => waiveCorrection(correctionId))}
        >
          Waive
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => setOurErrorFlag(correctionId, !ourError))}
        >
          {ourError ? "Clear our error" : "Mark our error"}
        </Button>
        {party === "doctor" ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => escalateDoctorDispute(correctionId))}
          >
            Escalate doctor dispute
          </Button>
        ) : null}
        {party === "doctor" && ourError && errorType === "founding_payment" ? (
          <Button
            type="button"
            disabled={pending}
            onClick={() => run(() => recreateFoundingFromCorrection(correctionId))}
          >
            Recreate £99 founding subscription
          </Button>
        ) : null}
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          formData.set("correction_id", correctionId);
          run(() => setClearRisk(formData));
        }}
      >
        <label className="text-sm">
          Clear risk code
          <select name="clear_risk_reason_code" className="ml-2 rounded-md border px-2 py-1">
            <option value="account_closing">account closing</option>
            <option value="suspected_fraud">suspected fraud</option>
            <option value="insolvency">insolvency</option>
          </select>
        </label>
        <Input name="clear_risk_reason" placeholder="Written reason" required />
        <Button type="submit" variant="outline" disabled={pending || party !== "doctor"}>
          Set clear risk
        </Button>
      </form>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          formData.set("correction_id", correctionId);
          run(() => recordPatientConsent(formData));
        }}
      >
        <Input name="how" placeholder="How consent was given" required />
        <Button type="submit" variant="outline" disabled={pending || party !== "patient"}>
          Record patient consent
        </Button>
      </form>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          formData.set("correction_id", correctionId);
          run(() => openDispute(formData));
        }}
      >
        <Input name="dispute_reason" placeholder="Dispute reason" required />
        <Button type="submit" variant="outline" disabled={pending}>
          Open dispute
        </Button>
      </form>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          formData.set("correction_id", correctionId);
          run(() => resolveDispute(formData));
        }}
      >
        <select name="dispute_outcome" className="rounded-md border px-2 py-1">
          <option value="customer_wins">customer wins</option>
          <option value="correction_upheld">correction upheld</option>
        </select>
        <Input name="dispute_findings" placeholder="Findings" required />
        <Button type="submit" variant="outline" disabled={pending}>
          Resolve dispute
        </Button>
      </form>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          formData.set("correction_id", correctionId);
          run(() => recordCustomerResponse(formData));
        }}
      >
        <Input name="customer_response" placeholder="Customer response" required />
        <Button type="submit" variant="outline" disabled={pending}>
          Record response
        </Button>
      </form>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          formData.set("correction_id", correctionId);
          run(() => runTransferReversal(formData));
        }}
      >
        <Input name="amount_cents" type="number" min={1} placeholder="Reversal cents" required />
        <Button type="submit" variant="outline" disabled={pending}>
          Reverse transfer
        </Button>
      </form>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          formData.set("correction_id", correctionId);
          run(() => markOffsetUncollectible(formData));
        }}
      >
        <Input name="reason" placeholder="Why the offset cannot be collected" required />
        <Button type="submit" variant="outline" disabled={pending}>
          Mark offset uncollectible
        </Button>
      </form>

      {message ? <p className="text-sm">{message}</p> : null}
    </div>
  );
}
