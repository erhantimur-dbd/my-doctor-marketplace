"use client";

import { Button } from "@/components/ui/button";
import { Video } from "lucide-react";

interface StartAppointmentButtonProps {
  videoRoomUrl: string;
  appointmentDate: string;
  startTime: string;
}

export function StartAppointmentButton({
  videoRoomUrl,
  appointmentDate,
  startTime,
}: StartAppointmentButtonProps) {
  const now = new Date();
  const start = new Date(`${appointmentDate}T${startTime}`);
  const minsBefore = (start.getTime() - now.getTime()) / 60000;
  // Enabled from 10 min before start to 60 min after start
  const enabled = minsBefore <= 10 && minsBefore >= -60;

  return (
    <Button
      size="sm"
      className="gap-1.5"
      disabled={!enabled}
      onClick={() => window.open(videoRoomUrl, "_blank")}
    >
      <Video className="h-3.5 w-3.5" />
      Start Appointment
    </Button>
  );
}
