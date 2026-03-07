"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SlotPicker } from "@/components/booking/slot-picker";
import { bookTreatmentPlanSession } from "@/actions/treatment-plan";
import { CalendarPlus, Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface BookTreatmentSessionDialogProps {
  treatmentPlanId: string;
  doctorId: string;
  consultationType: string;
  durationMinutes: number;
  serviceName: string;
  paymentType: "pay_full" | "pay_per_visit";
  planTitle: string;
}

export function BookTreatmentSessionDialog({
  treatmentPlanId,
  doctorId,
  consultationType,
  durationMinutes,
  serviceName,
  paymentType,
  planTitle,
}: BookTreatmentSessionDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  const handleSlotSelect = (date: string, startTime: string, endTime: string) => {
    setSelectedSlot({ date, startTime, endTime });
  };

  const handleBookSession = () => {
    if (!selectedSlot) return;

    startTransition(async () => {
      const result = await bookTreatmentPlanSession({
        treatment_plan_id: treatmentPlanId,
        appointment_date: selectedSlot.date,
        start_time: selectedSlot.startTime,
        end_time: selectedSlot.endTime,
      });

      if (result.error) {
        toast.error(result.error);
      } else if (result.url) {
        // Pay-per-visit: redirect to Stripe checkout
        window.location.href = result.url;
      } else {
        // Pay-full: session booked directly
        toast.success("Session booked successfully!");
        setOpen(false);
        setSelectedSlot(null);
        router.refresh();
      }
    });
  };

  const isPayPerVisit = paymentType === "pay_per_visit";
  const buttonLabel = isPayPerVisit ? "Book & Pay Next Session" : "Book Next Session";
  const confirmLabel = isPayPerVisit ? "Confirm & Pay" : "Confirm Session";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          {isPayPerVisit ? (
            <CreditCard className="h-3.5 w-3.5" />
          ) : (
            <CalendarPlus className="h-3.5 w-3.5" />
          )}
          {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Book Treatment Session</DialogTitle>
          <DialogDescription>
            Select a date and time for your next session of{" "}
            <span className="font-medium">{planTitle}</span>.
            {isPayPerVisit
              ? " You will be redirected to pay for this session."
              : " This session is already paid for."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <SlotPicker
            doctorId={doctorId}
            consultationType={consultationType}
            onSlotSelect={handleSlotSelect}
            slotDurationOverride={durationMinutes}
          />

          {selectedSlot && (
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={handleBookSession}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isPayPerVisit ? "Redirecting to payment..." : "Booking..."}
                </>
              ) : (
                <>
                  {isPayPerVisit ? (
                    <CreditCard className="h-4 w-4" />
                  ) : (
                    <CalendarPlus className="h-4 w-4" />
                  )}
                  {confirmLabel}
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
