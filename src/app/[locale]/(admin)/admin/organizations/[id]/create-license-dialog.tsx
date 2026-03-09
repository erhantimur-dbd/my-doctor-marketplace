"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Plus } from "lucide-react";
import { adminCreateLicense } from "@/actions/admin";

interface CreateLicenseDialogProps {
  organizationId: string;
  orgName: string;
}

const TIERS = [
  { id: "starter", name: "Starter", seats: 1 },
  { id: "professional", name: "Professional", seats: 3 },
  { id: "clinic", name: "Clinic", seats: 5 },
  { id: "enterprise", name: "Enterprise", seats: 999 },
];

export function CreateLicenseDialog({
  organizationId,
  orgName,
}: CreateLicenseDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState("");

  const [tier, setTier] = useState("starter");
  const [status, setStatus] = useState<"active" | "trialing">("trialing");
  const [maxSeats, setMaxSeats] = useState(1);
  const [trialDays, setTrialDays] = useState(14);
  const [isPromotional, setIsPromotional] = useState(true);
  const [promoNote, setPromoNote] = useState("");

  function onTierChange(newTier: string) {
    setTier(newTier);
    const t = TIERS.find((t) => t.id === newTier);
    if (t) setMaxSeats(t.seats);
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await adminCreateLicense({
        organization_id: organizationId,
        tier,
        status,
        max_seats: maxSeats,
        trial_days: status === "trialing" ? trialDays : undefined,
        is_promotional: isPromotional,
        promo_note: promoNote || undefined,
      });
      if (result.error) {
        setErrorMsg(result.error);
        setTimeout(() => setErrorMsg(""), 4000);
      } else {
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create License
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create License</DialogTitle>
          <DialogDescription>
            Grant a license to {orgName}. Free promotional licenses use the
            trial status with a custom expiry.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMsg}
            </div>
          )}

          {/* Tier */}
          <div className="space-y-2">
            <Label>Tier</Label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={tier}
              onChange={(e) => onTierChange(e.target.value)}
            >
              {TIERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.seats} seat{t.seats > 1 ? "s" : ""})
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label>License Type</Label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as "active" | "trialing")}
            >
              <option value="trialing">Free Trial (time-limited)</option>
              <option value="active">Active (comp license)</option>
            </select>
          </div>

          {/* Max Seats */}
          <div className="space-y-2">
            <Label>Max Seats</Label>
            <Input
              type="number"
              min={1}
              max={999}
              value={maxSeats}
              onChange={(e) => setMaxSeats(parseInt(e.target.value, 10) || 1)}
            />
          </div>

          {/* Trial Days (only for trialing) */}
          {status === "trialing" && (
            <div className="space-y-2">
              <Label>Trial Duration (days)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={trialDays}
                onChange={(e) => setTrialDays(parseInt(e.target.value, 10) || 14)}
              />
              <p className="text-xs text-muted-foreground">
                Expires on{" "}
                {new Date(
                  Date.now() + trialDays * 86400000
                ).toLocaleDateString()}
              </p>
            </div>
          )}

          {/* Promotional flag */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="promo"
              checked={isPromotional}
              onCheckedChange={(v) => setIsPromotional(!!v)}
            />
            <Label htmlFor="promo" className="text-sm">
              Mark as promotional / free offer
            </Label>
          </div>

          {/* Promo Note */}
          {isPromotional && (
            <div className="space-y-2">
              <Label>Note (optional)</Label>
              <Textarea
                placeholder="e.g., Beta partner, Conference lead, Referral reward"
                value={promoNote}
                onChange={(e) => setPromoNote(e.target.value)}
                rows={2}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create License
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
