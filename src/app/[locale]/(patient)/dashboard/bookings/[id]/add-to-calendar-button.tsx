"use client";

import { Button } from "@/components/ui/button";
import { CalendarPlus } from "lucide-react";
import { generateICS, downloadICS } from "@/lib/utils/ics";

interface AddToCalendarButtonProps {
  title: string;
  description?: string;
  start: string; // ISO string
  end: string; // ISO string
  location?: string;
  bookingNumber: string;
}

export function AddToCalendarButton({
  title,
  description,
  start,
  end,
  location,
  bookingNumber,
}: AddToCalendarButtonProps) {
  function handleClick() {
    const icsString = generateICS({
      title,
      description,
      start: new Date(start),
      end: new Date(end),
      location,
    });
    downloadICS(icsString, `booking-${bookingNumber}`);
  }

  return (
    <Button variant="outline" className="w-full" onClick={handleClick}>
      <CalendarPlus className="mr-2 h-4 w-4" />
      Add to Calendar
    </Button>
  );
}
