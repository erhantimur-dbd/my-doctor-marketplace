"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, RotateCcw } from "lucide-react";
import { adminRefundBooking } from "@/actions/admin";
import { toast } from "sonner";

interface RefundDialogProps {
  bookingId: string;
  totalAmountCents: number;
  currency: string;
}

export function RefundDialog({
  bookingId,
  totalAmountCents,
  currency,
}: RefundDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [amountCents, setAmountCents] = useState(totalAmountCents);
  const [reason, setReason] = useState("");

  const formatAmount = (cents: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "EUR",
    }).format(cents / 100);
  };

  const handleRefund = () => {
    startTransition(async () => {
      const result = await adminRefundBooking(bookingId, amountCents, reason || undefined);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Refund processed successfully");
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm" className="gap-1.5">
          <RotateCcw className="h-3.5 w-3.5" />
          Issue Refund
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue Refund</DialogTitle>
          <DialogDescription>
            Process a refund for this booking. The refund will be sent back to
            the patient&apos;s original payment method via Stripe.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label>Refund Amount</Label>
            <div className="mt-1.5 flex items-center gap-2">
              <Input
                type="number"
                min={1}
                max={totalAmountCents}
                step={1}
                value={amountCents}
                onChange={(e) => setAmountCents(Number(e.target.value))}
                className="w-[140px]"
              />
              <span className="text-sm text-muted-foreground">
                cents ({formatAmount(amountCents)})
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Full amount: {formatAmount(totalAmountCents)}
            </p>
          </div>
          <div>
            <Label>Reason (optional)</Label>
            <Textarea
              placeholder="e.g. Patient requested cancellation, service not provided..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1.5"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRefund}
            disabled={isPending || amountCents <= 0 || amountCents > totalAmountCents}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Refund ${formatAmount(amountCents)}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
