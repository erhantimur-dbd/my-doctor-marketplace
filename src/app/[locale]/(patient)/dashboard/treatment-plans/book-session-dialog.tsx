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
import { bookFollowUpSession } from "@/actions/follow-up";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface BookSessionDialogProps {
  invitationId: string;
  doctorId: string;
  consultationType: string;
  durationMinutes: number;
  serviceName: string;
}

export function BookSessionDialog({
  invitationId,
  doctorId,
  consultationType,
  durationMinutes,
  serviceName,
}: BookSessionDialogProps) {
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
      const result = await bookFollowUpSession({
        invitation_id: invitationId,
        appointment_date: selectedSlot.date,
        start_time: selectedSlot.startTime,
        end_time: selectedSlot.endTime,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Session booked successfully!");
        setOpen(false);
        setSelectedSlot(null);
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <CalendarPlus className="h-3.5 w-3.5" />
          Book Next Session
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Book Follow-Up Session</DialogTitle>
          <DialogDescription>
            Select a date and time for your next {serviceName} session.
            This session is already paid for.
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
                  Booking...
                </>
              ) : (
                <>
                  <CalendarPlus className="h-4 w-4" />
                  Confirm Session
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
