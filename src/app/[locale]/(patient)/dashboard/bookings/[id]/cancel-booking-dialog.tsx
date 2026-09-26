"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { XCircle, Loader2, Wallet, CreditCard, Zap, Clock } from "lucide-react";
import { toast } from "sonner";
import { cancelBooking } from "@/actions/booking";
import { formatCurrency } from "@/lib/utils/currency";

interface CancelBookingDialogProps {
  bookingId: string;
  bookingNumber: string;
  /** Estimated refund percent from cancellation policy (0–100). */
  refundPercent?: number;
  /** Estimated refund amount in cents. */
  refundAmountCents?: number;
  currency?: string;
  /** When false (Softsmoke / unpaid), hide refund destination choice. */
  hasRefundableCharge?: boolean;
}

export function CancelBookingDialog({
  bookingId,
  bookingNumber,
  refundPercent = 0,
  refundAmountCents = 0,
  currency = "EUR",
  hasRefundableCharge = false,
}: CancelBookingDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [destination, setDestination] = useState<"wallet" | "bank">("bank");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const showRefundChoice =
    hasRefundableCharge && refundPercent > 0 && refundAmountCents > 0;

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelBooking({
        booking_id: bookingId,
        reason: reason || undefined,
        refund_destination: showRefundChoice ? destination : "bank",
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if ("message" in result && result.message) {
        toast.success(result.message);
      } else {
        toast.success("Booking cancelled successfully.");
      }
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" className="w-full">
          <XCircle className="mr-2 h-4 w-4" />
          Cancel Booking
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Booking</DialogTitle>
          <DialogDescription>
            {showRefundChoice
              ? `Cancel booking #${bookingNumber}? You're eligible for a ${refundPercent}% refund of ${formatCurrency(refundAmountCents, currency)}.`
              : `Are you sure you want to cancel booking #${bookingNumber}? This action cannot be undone.`}
          </DialogDescription>
        </DialogHeader>

        {showRefundChoice && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setDestination("wallet")}
              className={`flex w-full items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors ${
                destination === "wallet"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/40"
              }`}
            >
              <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="flex-1">
                <p className="font-medium flex items-center gap-2">
                  Wallet credit
                  <span className="inline-flex items-center gap-1 text-xs font-normal text-emerald-600">
                    <Zap className="h-3 w-3" /> Instant
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Use toward your next booking immediately.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setDestination("bank")}
              className={`flex w-full items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors ${
                destination === "bank"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/40"
              }`}
            >
              <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="flex-1">
                <p className="font-medium flex items-center gap-2">
                  Original payment method
                  <span className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground">
                    <Clock className="h-3 w-3" /> 3–5 days
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Refund to the card or account you paid with.
                </p>
              </div>
            </button>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="cancel-reason">
            Reason for cancellation (optional)
          </Label>
          <Textarea
            id="cancel-reason"
            placeholder="Please let us know why you're cancelling..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Keep Booking
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              "Confirm Cancellation"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
