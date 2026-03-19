"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Wallet, CreditCard, Loader2, Zap, Clock } from "lucide-react";
import { cancelBooking } from "@/actions/booking";
import { formatCurrency } from "@/lib/utils/currency";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface RefundChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string;
  refundPercent: number;
  refundAmountCents: number;
  currency: string;
  walletBalanceCents: number;
}

export function RefundChoiceDialog({
  open,
  onOpenChange,
  bookingId,
  refundPercent,
  refundAmountCents,
  currency,
  walletBalanceCents,
}: RefundChoiceDialogProps) {
  const [destination, setDestination] = useState<"wallet" | "bank">("wallet");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await cancelBooking({
        booking_id: bookingId,
        reason: reason || undefined,
        refund_destination: destination,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if ("message" in result) {
        toast.success(result.message as string);
      }
      onOpenChange(false);
      router.refresh();
    });
  };

  const newWalletBalance = walletBalanceCents + refundAmountCents;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Booking</DialogTitle>
          <DialogDescription>
            {refundPercent > 0
              ? `You're eligible for a ${refundPercent}% refund of ${formatCurrency(refundAmountCents, currency)}. How would you like to receive it?`
              : "No refund is applicable based on the cancellation policy. Would you like to proceed?"}
          </DialogDescription>
        </DialogHeader>

        {refundPercent > 0 && (
          <div className="space-y-3">
            {/* Wallet option */}
            <button
              onClick={() => setDestination("wallet")}
              className={`flex w-full items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors ${
                destination === "wallet"
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="mt-0.5 rounded-full bg-green-100 p-2">
                <Wallet className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">Credit to Wallet</p>
                  <span className="flex items-center gap-0.5 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    <Zap className="h-3 w-3" /> Instant
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Get {formatCurrency(refundAmountCents, currency)} credited instantly. Use it for your next booking.
                </p>
                <p className="mt-1 text-xs text-green-600">
                  New wallet balance: {formatCurrency(newWalletBalance, currency)}
                </p>
              </div>
            </button>

            {/* Bank option */}
            <button
              onClick={() => setDestination("bank")}
              className={`flex w-full items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors ${
                destination === "bank"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="mt-0.5 rounded-full bg-blue-100 p-2">
                <CreditCard className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">Refund to Bank</p>
                  <span className="flex items-center gap-0.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                    <Clock className="h-3 w-3" /> 3-5 days
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Refund {formatCurrency(refundAmountCents, currency)} back to your original payment method.
                </p>
              </div>
            </button>
          </div>
        )}

        <div>
          <Label className="text-sm">Reason (optional)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why are you cancelling?"
            rows={2}
            className="mt-1"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Keep Booking
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {refundPercent > 0
              ? destination === "wallet"
                ? "Cancel & Credit Wallet"
                : "Cancel & Refund to Bank"
              : "Cancel Booking"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
