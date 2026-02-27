"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDoctorAvailableSlots } from "@/actions/booking";
import { Clock, CalendarDays } from "lucide-react";
import { format, isBefore, startOfDay } from "date-fns";
import type { AvailableSlot } from "@/types/index";
import { cn } from "@/lib/utils";

interface SlotPickerProps {
  doctorId: string;
  consultationType: string;
  onSlotSelect: (date: string, startTime: string, endTime: string) => void;
  initialDate?: string; // "YYYY-MM-DD" — auto-select this date on mount
}

export function SlotPicker({
  doctorId,
  consultationType,
  onSlotSelect,
  initialDate,
}: SlotPickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    initialDate ? new Date(initialDate + "T00:00:00") : undefined
  );
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{
    start: string;
    end: string;
  } | null>(null);

  const today = startOfDay(new Date());

  const fetchSlots = useCallback(
    async (date: Date) => {
      setLoading(true);
      setError(null);
      setSlots([]);
      setSelectedSlot(null);

      const dateStr = format(date, "yyyy-MM-dd");
      const result = await getDoctorAvailableSlots(
        doctorId,
        dateStr,
        consultationType
      );

      if (result.error) {
        setError(result.error);
      } else {
        setSlots(result.slots.filter((s) => s.is_available));
      }
      setLoading(false);
    },
    [doctorId, consultationType]
  );

  useEffect(() => {
    if (selectedDate) {
      fetchSlots(selectedDate);
    }
  }, [selectedDate, fetchSlots]);

  function handleDateSelect(date: Date | undefined) {
    if (!date) return;
    setSelectedDate(date);
  }

  function handleSlotClick(slot: AvailableSlot) {
    setSelectedSlot({ start: slot.slot_start, end: slot.slot_end });
    if (selectedDate) {
      onSlotSelect(
        format(selectedDate, "yyyy-MM-dd"),
        slot.slot_start,
        slot.slot_end
      );
    }
  }

  function formatTime(time: string): string {
    // Handle both "HH:mm:ss" and "HH:mm" formats
    const parts = time.split(":");
    return `${parts[0]}:${parts[1]}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-6 md:flex-row">
        {/* Calendar */}
        <div className="shrink-0">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="h-4 w-4" />
            Select a Date
          </div>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={(date) => isBefore(startOfDay(date), today)}
            className="rounded-md border"
          />
        </div>

        {/* Time Slots */}
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Clock className="h-4 w-4" />
            Available Times
          </div>

          {!selectedDate && (
            <div className="flex h-48 items-center justify-center rounded-md border border-dashed">
              <p className="text-sm text-muted-foreground">
                Select a date to view available time slots
              </p>
            </div>
          )}

          {selectedDate && loading && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          )}

          {selectedDate && !loading && error && (
            <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-destructive/50">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {selectedDate && !loading && !error && slots.length === 0 && (
            <div className="flex h-48 items-center justify-center rounded-md border border-dashed">
              <div className="text-center">
                <Clock className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No available slots for this date
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try selecting a different date
                </p>
              </div>
            </div>
          )}

          {selectedDate && !loading && !error && slots.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((slot) => {
                const isSelected =
                  selectedSlot?.start === slot.slot_start &&
                  selectedSlot?.end === slot.slot_end;

                return (
                  <Button
                    key={`${slot.slot_start}-${slot.slot_end}`}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "h-10 text-sm",
                      isSelected && "ring-2 ring-primary ring-offset-2"
                    )}
                    onClick={() => handleSlotClick(slot)}
                  >
                    {formatTime(slot.slot_start)}
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
