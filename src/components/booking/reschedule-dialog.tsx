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
  DialogClose,
} from "@/components/ui/dialog";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { requestReschedule } from "@/actions/reschedule";
import { SlotPicker } from "./slot-picker";

interface RescheduleDialogProps {
  bookingId: string;
  doctorId: string;
  consultationType: string;
  bookingNumber: string;
}

export function RescheduleDialog({
  bookingId,
  doctorId,
  consultationType,
  bookingNumber,
}: RescheduleDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  function handleSlotSelect(date: string, startTime: string, endTime: string) {
    setSelectedSlot({ date, startTime, endTime });
  }

  function handleSubmit() {
    if (!selectedSlot) return;

    startTransition(async () => {
      const result = await requestReschedule({
        booking_id: bookingId,
        new_date: selectedSlot.date,
        new_start_time: selectedSlot.startTime,
        new_end_time: selectedSlot.endTime,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          "Reschedule request sent! Your doctor will review it shortly."
        );
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSelectedSlot(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <CalendarClock className="mr-2 h-4 w-4" />
          Reschedule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reschedule Appointment</DialogTitle>
          <DialogDescription>
            Select a new date and time for booking #{bookingNumber}. Your doctor
            will need to approve the change.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <SlotPicker
            doctorId={doctorId}
            consultationType={consultationType}
            onSlotSelect={handleSlotSelect}
          />

          {selectedSlot && (
            <div className="mt-4 rounded-lg border bg-primary/5 p-3">
              <p className="text-sm font-medium">New appointment:</p>
              <p className="text-sm text-muted-foreground">
                {new Date(
                  selectedSlot.date + "T00:00:00"
                ).toLocaleDateString("en-GB", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}{" "}
                at {selectedSlot.startTime.substring(0, 5)} -{" "}
                {selectedSlot.endTime.substring(0, 5)}
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={!selectedSlot || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Request Reschedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
