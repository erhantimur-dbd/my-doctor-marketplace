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

// Custom DayButton with coloured cell backgrounds for availability
function DayButtonWithDot({
  modifiers,
  children,
  className,
  ...rest
}: React.ComponentProps<typeof DayButtonType>) {
  const isAvailable = (modifiers as Record<string, boolean>).available;
  const isFewSlots = (modifiers as Record<string, boolean>).fewSlots;
  const isSelected = (modifiers as Record<string, boolean>).selected;

  return (
    <CalendarDayButton
      modifiers={modifiers}
      className={cn(
        "transition-colors duration-150",
        isAvailable && !isSelected &&
          "bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:hover:bg-emerald-950/50",
        isFewSlots && !isSelected &&
          "bg-amber-50 text-amber-700 font-medium hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300 dark:hover:bg-amber-950/50",
        className
      )}
      {...rest}
    >
      {children}
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

  // Track whether we've auto-selected so we only do it once per type change
  const hasAutoSelected = useRef(false);

  // Load dates when month or type changes
  useEffect(() => {
    let cancelled = false;
    setLoadingDates(true);

    fetchDatesForMonth(currentMonth, activeType).then((dates) => {
      if (!cancelled) {
        setAvailableDates(dates);
        setLoadingDates(false);

        // Auto-select first available day (only once per type change, not on month nav)
        if (!hasAutoSelected.current && !selectedDate && dates.length > 0) {
          const firstAvailable = dates.find((d) => d.slotCount > 0);
          if (firstAvailable) {
            setSelectedDate(new Date(firstAvailable.date + "T00:00:00"));
            hasAutoSelected.current = true;
          }
        }
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
    hasAutoSelected.current = false;
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
      `/doctors/${doctorSlug}/book?date=${dateStr}&type=${activeType}&time=${encodeURIComponent(slot.slot_start)}`
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
    <div className={cn("space-y-3", compact && "space-y-1.5 flex flex-col h-full")}>
      {/* Consultation type toggle */}
      {showTypeToggle && (
        <div className={cn("flex gap-1 bg-muted p-1", compact ? "rounded-xl" : "rounded-lg")}>
          {consultationTypes!.includes("in_person") && (
            <button
              type="button"
              onClick={() => handleTypeChange("in_person")}
              className={cn(
                "flex-1 text-sm font-medium transition-all duration-200",
                compact ? "rounded-lg px-3 py-1.5" : "rounded-md px-3 py-1.5",
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
                "flex-1 text-sm font-medium transition-all duration-200",
                compact ? "rounded-lg px-3 py-1.5" : "rounded-md px-3 py-1.5",
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
      <div className={cn("relative", compact && "max-w-[500px] mx-auto")}>
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
          className={cn(
            "w-full",
            compact
              ? "rounded-xl bg-muted/30 p-3 [--cell-size:--spacing(7)]"
              : "rounded-md border p-3"
          )}
          classNames={compact ? {
            month: "flex flex-col w-full gap-2",
            week: "flex w-full mt-1 [&>*]:flex-1",
            weekdays: "flex [&>*]:flex-1",
            weekday: "text-muted-foreground/60 flex-1 font-medium text-[0.65rem] uppercase tracking-widest select-none pb-1",
            caption_label: "select-none font-semibold text-sm tracking-tight",
            today: "ring-2 ring-primary/30 rounded-md data-[selected=true]:ring-0",
          } : undefined}
        />
      </div>

      {/* Legend */}
      <div className={cn(
        "flex items-center gap-5 text-[11px] text-muted-foreground/70",
        compact && "justify-center"
      )}>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30" />
          {t("availability")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30" />
          {t("few_slots_left")}
        </span>
      </div>

      {/* Time slots section */}
      <div className={compact ? "min-h-[60px] flex-1 overflow-y-auto" : "min-h-[80px]"}>
        {!selectedDate && (
          <div className={cn(
            "flex items-center justify-center rounded-md border border-dashed",
            compact ? "h-14" : "h-20"
          )}>
            <p className="text-sm text-muted-foreground">
              {t("select_date")}
            </p>
          </div>
        )}

        {selectedDate && loadingSlots && (
          <div>
            <p className={cn("font-medium", compact ? "mb-1.5 text-xs" : "mb-2 text-sm")}>
              <Clock className="mr-1.5 inline-block h-3.5 w-3.5" />
              {t("available_times")}
            </p>
            <div className={cn("grid", compact ? "grid-cols-3 gap-1.5" : "grid-cols-3 gap-1.5 sm:grid-cols-4")}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className={cn("w-full rounded-md", compact ? "h-8" : "h-9")} />
              ))}
            </div>
          </div>
        )}

        {selectedDate && !loadingSlots && slots.length === 0 && (
          <div className={cn(
            "flex items-center justify-center rounded-md border border-dashed",
            compact ? "h-14" : "h-20"
          )}>
            <p className="text-sm text-muted-foreground">
              {t("no_slots_this_date")}
            </p>
          </div>
        )}

        {selectedDate && !loadingSlots && slots.length > 0 && (
          <div>
            <div className={cn("flex items-center gap-2", compact ? "mb-2" : "mb-2")}>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800 dark:text-blue-300">
                <Clock className="h-3.5 w-3.5" />
                {t("available_times")}
              </div>
              <span className="text-xs text-muted-foreground/60">
                {format(selectedDate, "EEE, d MMM", { locale: dateFnsLocale })}
              </span>
            </div>
            <div className={cn(
              "grid",
              compact ? "grid-cols-3 gap-1.5" : "grid-cols-3 gap-1.5 sm:grid-cols-4"
            )}>
              {slots.map((slot) => (
                <Button
                  key={`${slot.slot_start}-${slot.slot_end}`}
                  variant="outline"
                  size="sm"
                  className={cn(
                    "font-medium rounded-lg border-blue-200/60 bg-blue-50 text-blue-700 transition-all hover:bg-blue-600 hover:text-white hover:border-blue-600 hover:shadow-sm dark:bg-blue-950/25 dark:text-blue-300 dark:border-blue-800/40 dark:hover:bg-blue-600 dark:hover:text-white",
                    compact ? "h-8 text-sm" : "h-9 text-sm"
                  )}
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
