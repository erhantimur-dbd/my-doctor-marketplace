"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { adminGrantDoctorSubscription } from "@/actions/admin";
import { Gift, Loader2 } from "lucide-react";

interface GrantSubscriptionDialogProps {
  doctorId: string;
  onGranted?: (tier: string) => void;
}

export function GrantSubscriptionDialog({
  doctorId,
  onGranted,
}: GrantSubscriptionDialogProps) {
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<"starter" | "professional" | "clinic">(
    "starter"
  );
  const [durationDays, setDurationDays] = useState("30");
  const [status, setStatus] = useState<"trialing" | "active">("trialing");
  const [promoNote, setPromoNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGrant() {
    setLoading(true);
    const result = await adminGrantDoctorSubscription({
      doctorId,
      tier,
      durationDays: Number(durationDays),
      status,
      promoNote: promoNote.trim() || undefined,
    });

    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(
        `${tier.charAt(0).toUpperCase() + tier.slice(1)} subscription granted (${status === "trialing" ? "trial" : "complimentary"}, ${durationDays} days)`
      );
      setOpen(false);
      onGranted?.(tier);
    }
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Gift className="mr-1 h-4 w-4" />
          Grant Subscription
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Grant Subscription</DialogTitle>
          <DialogDescription>
            Grant a trial or complimentary subscription to this doctor. No
            payment required.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Tier */}
          <div className="space-y-2">
            <Label>Plan Tier</Label>
            <Select
              value={tier}
              onValueChange={(v) =>
                setTier(v as "starter" | "professional" | "clinic")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="starter">
                  Starter — Solo practitioner
                </SelectItem>
                <SelectItem value="professional">
                  Professional — Advanced tools
                </SelectItem>
                <SelectItem value="clinic">
                  Clinic — Multi-doctor practice
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration</Label>
            <Select value={durationDays} onValueChange={setDurationDays}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="60">60 days</SelectItem>
                <SelectItem value="90">90 days (3 months)</SelectItem>
                <SelectItem value="180">180 days (6 months)</SelectItem>
                <SelectItem value="365">365 days (1 year)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Type</Label>
            <RadioGroup
              value={status}
              onValueChange={(v) => setStatus(v as "trialing" | "active")}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="trialing" id="type-trial" />
                <Label htmlFor="type-trial" className="font-normal cursor-pointer">
                  Trial
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="active" id="type-comp" />
                <Label htmlFor="type-comp" className="font-normal cursor-pointer">
                  Complimentary
                </Label>
              </div>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              {status === "trialing"
                ? "Doctor sees this as a trial period that will expire"
                : "Doctor sees this as an active complimentary subscription"}
            </p>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label>
              Note <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              value={promoNote}
              onChange={(e) => setPromoNote(e.target.value)}
              placeholder="e.g. Founder early access program, Beta tester reward..."
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleGrant} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Granting...
              </>
            ) : (
              <>
                <Gift className="mr-1 h-4 w-4" />
                Grant {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
