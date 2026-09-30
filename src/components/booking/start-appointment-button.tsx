"use client";

import { JoinConsultButton } from "@/components/booking/join-consult-button";
import { isWithinConsultJoinWindow } from "@/lib/video/meeting-window";

interface StartAppointmentButtonProps {
  bookingId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
}

export function StartAppointmentButton({
  bookingId,
  appointmentDate,
  startTime,
  endTime,
}: StartAppointmentButtonProps) {
  const enabled = isWithinConsultJoinWindow({
    now: new Date(),
    appointmentDate,
    startTime,
    endTime,
  });

  return (
    <JoinConsultButton
      bookingId={bookingId}
      source="doctor_dashboard"
      label="Start Appointment"
      disabled={!enabled}
      size="sm"
    />
  );
}
