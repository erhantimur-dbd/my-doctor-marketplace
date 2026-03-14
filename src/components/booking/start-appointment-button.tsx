"use client";

import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

interface StartAppointmentButtonProps {
  videoRoomUrl: string;
  appointmentDate: string;
  startTime: string;
  /** When provided, navigates to the in-app waiting room instead of opening video directly */
  bookingId?: string;
}

export function StartAppointmentButton({
  videoRoomUrl,
  appointmentDate,
  startTime,
  bookingId,
}: StartAppointmentButtonProps) {
  const router = useRouter();
  const now = new Date();
  const start = new Date(`${appointmentDate}T${startTime}`);
  const minsBefore = (start.getTime() - now.getTime()) / 60000;
  // Enabled from 10 min before start to 60 min after start
  const enabled = minsBefore <= 10 && minsBefore >= -60;

  function handleClick() {
    if (bookingId) {
      // Navigate to the waiting room page
      router.push(`/dashboard/bookings/${bookingId}/video-room`);
    } else {
      // Open video directly (for doctors or fallback)
      window.open(videoRoomUrl, "_blank");
    }
  }

  return (
    <Button
      size="sm"
      className="gap-1.5"
      disabled={!enabled}
      onClick={handleClick}
    >
      <Video className="h-3.5 w-3.5" />
      {bookingId ? "Join Video Call" : "Start Appointment"}
    </Button>
  );
}
