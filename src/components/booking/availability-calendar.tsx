"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import type { DayButton as DayButtonType } from "react-day-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { getDoctorAvailableDates, getDoctorAvailableSlots } from "@/actions/booking";
import type { AvailableDateInfo } from "@/actions/booking";
import type { AvailableSlot } from "@/types/index";
import { Clock, CalendarDays, Loader2 } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  isBefore,
  startOfDay,
  addMonths,
} from "date-fns";
import { localeMap } from "@/lib/utils/date";
import { formatSlotTime } from "@/lib/utils/availability";
import { cn } from "@/lib/utils";

interface AvailabilityCalendarProps {
  doctorId: string;
  doctorSlug: string;
  consultationType?: string;
  consultationTypes?: string[];
  compact?: boolean;
  initialDate?: string; // "YYYY-MM-DD"
  locale?: string;
}

// Custom DayButton that renders availability dots as real DOM elements
// instead of ::after pseudo-elements (which break table height calculation)
function DayButtonWithDot({
  modifiers,
  children,
  ...rest
}: React.ComponentProps<typeof DayButtonType>) {
  const isAvailable = (modifiers as Record<string, boolean>).available;
  const isFewSlots = (modifiers as Record<string, boolean>).fewSlots;

  return (
    <CalendarDayButton modifiers={modifiers} {...rest}>
      {children}
      {(isAvailable || isFewSlots) && (
        <span
          className={cn(
            "h-1 w-1 rounded-full",
            isAvailable ? "bg-green-500" : "bg-amber-500"
          )}
        />
      )}
    </CalendarDayButton>
  );
}

export function AvailabilityCalendar({
  doctorId,
  doctorSlug,
  consultationType = "in_person",
  consultationTypes,
  compact = false,
  initialDate,
  locale = "en",
}: AvailabilityCalendarProps) {
  const router = useRouter();
  const t = useTranslations("doctor");
  const today = startOfDay(new Date());

  const [activeType, setActiveType] = useState(consultationType);
  const [currentMonth, setCurrentMonth] = useState<Date>(
    initialDate ? new Date(initialDate + "T00:00:00") : new Date()
  );
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    initialDate ? new Date(initialDate + "T00:00:00") : undefined
  );

  // Cache: month key → available dates
  const dateCache = useRef<Map<string, AvailableDateInfo[]>>(new Map());
  const [availableDates, setAvailableDates] = useState<AvailableDateInfo[]>([]);
  const [loadingDates, setLoadingDates] = useState(true);

  // Slots for the selected date
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Build a cache key from month + consultation type
  const cacheKey = useCallback(
    (month: Date, type: string) =>
      `${format(month, "yyyy-MM")}_${type}`,
    []
  );

  // Fetch available dates for a month
  const fetchDatesForMonth = useCallback(
    async (month: Date, type: string) => {
      const key = cacheKey(month, type);
      if (dateCache.current.has(key)) {
        return dateCache.current.get(key)!;
      }

      const start = format(startOfMonth(month), "yyyy-MM-dd");
      const end = format(endOfMonth(month), "yyyy-MM-dd");
      const result = await getDoctorAvailableDates(doctorId, start, end, type);

      if (!result.error) {
        dateCache.current.set(key, result.dates);
      }
      return result.dates;
    },
    [doctorId, cacheKey]
  );

  // Load dates when month or type changes
  useEffect(() => {
    let cancelled = false;
    setLoadingDates(true);

    fetchDatesForMonth(currentMonth, activeType).then((dates) => {
      if (!cancelled) {
        setAvailableDates(dates);
        setLoadingDates(false);
      }
    });

    // Prefetch next month in background
    const nextMonth = addMonths(currentMonth, 1);
    fetchDatesForMonth(nextMonth, activeType);

    return () => {
      cancelled = true;
    };
  }, [currentMonth, activeType, fetchDatesForMonth]);

  // Fetch time slots when a date is selected
  useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      return;
    }

    let cancelled = false;
    setLoadingSlots(true);

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    getDoctorAvailableSlots(doctorId, dateStr, activeType).then((result) => {
      if (!cancelled) {
        setSlots(result.slots.filter((s) => s.is_available));
        setLoadingSlots(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, doctorId, activeType]);

  // Handle consultation type change
  const handleTypeChange = (type: string) => {
    setActiveType(type);
    setSelectedDate(undefined);
    setSlots([]);
  };

  // Handle month navigation
  const handleMonthChange = (month: Date) => {
    setCurrentMonth(month);
  };

  // Handle slot click → navigate to booking
  const handleSlotClick = (slot: AvailableSlot) => {
    if (!selectedDate) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    router.push(
      `/doctors/${doctorSlug}/book?date=${dateStr}&type=${activeType}`
    );
  };

  // Build modifiers for highlighting available dates
  const availableModifierDates = availableDates
    .filter((d) => d.slotCount >= 3)
    .map((d) => new Date(d.date + "T00:00:00"));
  const fewSlotsModifierDates = availableDates
    .filter((d) => d.slotCount > 0 && d.slotCount < 3)
    .map((d) => new Date(d.date + "T00:00:00"));

  const showTypeToggle =
    consultationTypes && consultationTypes.length > 1;

  const dateFnsLocale = localeMap[locale] || localeMap.en;

  return (
    <div className={cn("space-y-4", compact && "space-y-3")}>
      {/* Consultation type toggle */}
      {showTypeToggle && (
        <div className="flex gap-1.5 rounded-lg bg-muted p-1">
          {consultationTypes!.includes("in_person") && (
            <button
              type="button"
              onClick={() => handleTypeChange("in_person")}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeType === "in_person"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("in_person")}
            </button>
          )}
          {consultationTypes!.includes("video") && (
            <button
              type="button"
              onClick={() => handleTypeChange("video")}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                activeType === "video"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("video_call")}
            </button>
          )}
        </div>
      )}

      {/* Calendar */}
      <div className="relative">
        {loadingDates && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-md">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && setSelectedDate(date)}
          month={currentMonth}
          onMonthChange={handleMonthChange}
          disabled={(date) => isBefore(startOfDay(date), today)}
          locale={dateFnsLocale}
          modifiers={{
            available: availableModifierDates,
            fewSlots: fewSlotsModifierDates,
          }}
          components={{
            DayButton: DayButtonWithDot,
            // Replace table elements with divs to fix Safari height calculation
            // Safari ignores display:flex on <table>/<tbody> elements
            MonthGrid: (props) => <div role="grid" {...props} />,
            Weekdays: ({ className, ...props }) => (
              <div role="rowgroup" aria-hidden>
                <div role="row" className={className} {...props} />
              </div>
            ),
            Week: ({ week, ...props }) => <div role="row" {...props} />,
            Weeks: (props) => <div role="rowgroup" {...props} />,
          }}
          className="rounded-md border w-full"
        />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          {t("availability")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
          {t("few_slots_left")}
        </span>
      </div>

      {/* Time slots section */}
      <div className="min-h-[80px]">
        {!selectedDate && (
          <div className="flex h-20 items-center justify-center rounded-md border border-dashed">
            <p className="text-sm text-muted-foreground">
              {t("select_date")}
            </p>
          </div>
        )}

        {selectedDate && loadingSlots && (
          <div>
            <p className="mb-2 text-sm font-medium">
              <Clock className="mr-1.5 inline-block h-3.5 w-3.5" />
              {t("available_times")}
            </p>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full rounded-md" />
              ))}
            </div>
          </div>
        )}

        {selectedDate && !loadingSlots && slots.length === 0 && (
          <div className="flex h-20 items-center justify-center rounded-md border border-dashed">
            <p className="text-sm text-muted-foreground">
              {t("no_slots_this_date")}
            </p>
          </div>
        )}

        {selectedDate && !loadingSlots && slots.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">
              <Clock className="mr-1.5 inline-block h-3.5 w-3.5" />
              {t("available_times")} — {format(selectedDate, "EEE, d MMM", { locale: dateFnsLocale })}
            </p>
            <div className={cn(
              "grid gap-1.5",
              compact ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-4"
            )}>
              {slots.map((slot) => (
                <Button
                  key={`${slot.slot_start}-${slot.slot_end}`}
                  variant="outline"
                  size="sm"
                  className="h-9 text-sm font-medium border-primary/20 bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground"
                  onClick={() => handleSlotClick(slot)}
                >
                  {formatSlotTime(slot.slot_start)}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
