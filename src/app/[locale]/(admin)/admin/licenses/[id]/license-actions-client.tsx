"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";
import {
  adminOverrideLicenseStatus,
  adminChangeLicenseTier,
  adminAdjustLicenseSeats,
  adminExtendLicensePeriod,
} from "@/actions/admin";

interface LicenseActionsClientProps {
  licenseId: string;
  currentStatus: string;
  currentTier: string;
  maxSeats: number;
  extraSeatCount: number;
  usedSeats: number;
  currentPeriodEnd: string;
  hasStripeSubscription: boolean;
}

const STATUSES = [
  "active",
  "trialing",
  "past_due",
  "grace_period",
  "suspended",
  "cancelled",
];

const TIERS = [
  { id: "starter", name: "Starter" },
  { id: "professional", name: "Professional" },
  { id: "clinic", name: "Clinic" },
  { id: "enterprise", name: "Enterprise" },
];

export function LicenseActionsClient({
  licenseId,
  currentStatus,
  currentTier,
  maxSeats,
  extraSeatCount,
  usedSeats,
  currentPeriodEnd,
  hasStripeSubscription,
}: LicenseActionsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Status override state
  const [newStatus, setNewStatus] = useState(currentStatus);
  const [reason, setReason] = useState("");

  // Tier change state
  const [newTier, setNewTier] = useState(currentTier);

  // Seats state
  const [seatMax, setSeatMax] = useState(maxSeats);
  const [seatExtra, setSeatExtra] = useState(extraSeatCount);

  // Period state
  const [periodEnd, setPeriodEnd] = useState(
    currentPeriodEnd ? new Date(currentPeriodEnd).toISOString().split("T")[0] : ""
  );

  function showMsg(type: "success" | "error", text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 4000);
  }

  function handleStatusOverride() {
    if (newStatus === currentStatus) return;
    if (!reason.trim()) {
      showMsg("error", "Please provide a reason");
      return;
    }
    startTransition(async () => {
      const result = await adminOverrideLicenseStatus(licenseId, newStatus, reason);
      if (result.error) {
        showMsg("error", result.error);
      } else {
        showMsg("success", `Status changed to ${newStatus}`);
        setReason("");
        router.refresh();
      }
    });
  }

  function handleTierChange() {
    if (newTier === currentTier) return;
    startTransition(async () => {
      const result = await adminChangeLicenseTier(licenseId, newTier);
      if (result.error) {
        showMsg("error", result.error);
      } else {
        showMsg("success", `Tier changed to ${newTier}`);
        router.refresh();
      }
    });
  }

  function handleSeatsAdjust() {
    startTransition(async () => {
      const result = await adminAdjustLicenseSeats(licenseId, seatMax, seatExtra);
      if (result.error) {
        showMsg("error", result.error);
      } else {
        showMsg("success", "Seats updated");
        router.refresh();
      }
    });
  }

  function handleExtendPeriod() {
    if (!periodEnd) return;
    startTransition(async () => {
      const result = await adminExtendLicensePeriod(licenseId, periodEnd);
      if (result.error) {
        showMsg("error", result.error);
      } else {
        showMsg("success", "Period extended");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-5">
      {msg && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            msg.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* Override Status */}
      <div className="space-y-3">
        <Label className="font-semibold">Override Status</Label>
        <select
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s} {s === currentStatus ? "(current)" : ""}
            </option>
          ))}
        </select>
        <Textarea
          placeholder="Reason for status change (required)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
        />
        <Button
          size="sm"
          onClick={handleStatusOverride}
          disabled={isPending || newStatus === currentStatus || !reason.trim()}
        >
          {isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          Update Status
        </Button>
      </div>

      <Separator />

      {/* Change Tier */}
      <div className="space-y-3">
        <Label className="font-semibold">Change Tier</Label>
        <select
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={newTier}
          onChange={(e) => setNewTier(e.target.value)}
        >
          {TIERS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} {t.id === currentTier ? "(current)" : ""}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          onClick={handleTierChange}
          disabled={isPending || newTier === currentTier}
        >
          {isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          Change Tier
        </Button>
      </div>

      <Separator />

      {/* Adjust Seats */}
      <div className="space-y-3">
        <Label className="font-semibold">Adjust Seats</Label>
        <p className="text-xs text-muted-foreground">
          Currently using {usedSeats} seat(s)
        </p>
        <div className="flex gap-3">
          <div className="flex-1">
            <Label className="text-xs">Max Seats</Label>
            <Input
              type="number"
              min={usedSeats || 1}
              max={999}
              value={seatMax}
              onChange={(e) => setSeatMax(parseInt(e.target.value, 10) || 1)}
            />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Extra Seats</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={seatExtra}
              onChange={(e) => setSeatExtra(parseInt(e.target.value, 10) || 0)}
            />
          </div>
        </div>
        {hasStripeSubscription && seatExtra !== extraSeatCount && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
            <strong>Billing impact:</strong>{" "}
            {seatExtra > extraSeatCount
              ? `Adding ${seatExtra - extraSeatCount} seat(s) will add £${((seatExtra - extraSeatCount) * 299).toFixed(0)}/mo to this doctor's Stripe subscription (prorated immediately).`
              : `Removing ${extraSeatCount - seatExtra} seat(s) will reduce billing by £${((extraSeatCount - seatExtra) * 299).toFixed(0)}/mo (prorated credit applied).`}
          </div>
        )}
        <Button size="sm" onClick={handleSeatsAdjust} disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          {hasStripeSubscription ? "Save Seats & Update Billing" : "Save Seats"}
        </Button>
      </div>

      <Separator />

      {/* Extend Period */}
      <div className="space-y-3">
        <Label className="font-semibold">Extend Period</Label>
        <Input
          type="date"
          value={periodEnd}
          onChange={(e) => setPeriodEnd(e.target.value)}
        />
        <Button
          size="sm"
          onClick={handleExtendPeriod}
          disabled={isPending || !periodEnd}
        >
          {isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
          Extend Period
        </Button>
      </div>
    </div>
  );
}
