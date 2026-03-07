"use client";

import { useState, useMemo } from "react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, Video, User, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarBooking {
  id: string;
  booking_number: string;
  start_time: string;
  end_time: string;
  status: string;
  consultation_type: string;
  doctor: {
    title: string | null;
    profile: {
      first_name: string;
      last_name: string;
    };
  };
}

interface CalendarViewProps {
  bookings: CalendarBooking[];
  locale: string;
}

function getStatusDotColor(status: string): string {
  switch (status) {
    case "confirmed":
    case "approved":
      return "bg-green-500";
    case "completed":
      return "bg-blue-500";
    case "pending_payment":
    case "pending_approval":
      return "bg-yellow-500";
    case "cancelled_patient":
    case "cancelled_doctor":
    case "no_show":
    case "refunded":
      return "bg-red-500";
    default:
      return "bg-gray-400";
  }
}

function getStatusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "confirmed":
    case "approved":
      return "default";
    case "pending_payment":
    case "pending_approval":
      return "secondary";
    case "completed":
      return "outline";
    case "cancelled_patient":
    case "cancelled_doctor":
    case "no_show":
    case "refunded":
      return "destructive";
    default:
      return "secondary";
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case "confirmed":
    case "approved":
      return "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400";
    case "pending_payment":
    case "pending_approval":
      return "bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400";
    case "completed":
      return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400";
    case "cancelled_patient":
    case "cancelled_doctor":
    case "no_show":
    case "refunded":
      return "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400";
    default:
      return "";
  }
}

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

const DAY_LABELS: Record<string, string[]> = {
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  de: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
  tr: ["Pzt", "Sal", "Car", "Per", "Cum", "Cmt", "Paz"],
  fr: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
};

const MONTH_LABELS: Record<string, string[]> = {
  en: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  de: [
    "Januar", "Februar", "M\u00e4rz", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
  ],
  tr: [
    "Ocak", "\u015eubat", "Mart", "Nisan", "May\u0131s", "Haziran",
    "Temmuz", "A\u011fustos", "Eyl\u00fcl", "Ekim", "Kas\u0131m", "Aral\u0131k",
  ],
  fr: [
    "Janvier", "F\u00e9vrier", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Ao\u00fbt", "Septembre", "Octobre", "Novembre", "D\u00e9cembre",
  ],
};

export function CalendarView({ bookings, locale }: CalendarViewProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  const dayLabels = DAY_LABELS[locale] || DAY_LABELS.en;
  const monthLabels = MONTH_LABELS[locale] || MONTH_LABELS.en;

  // Group bookings by date key (YYYY-MM-DD)
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    for (const booking of bookings) {
      const d = new Date(booking.start_time);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(booking);
    }
    return map;
  }, [bookings]);

  // Calculate calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();

    // getDay() returns 0=Sun, we want 0=Mon
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days: Array<{ day: number; isCurrentMonth: boolean; date: Date }> = [];

    // Fill in days from previous month
    const prevMonthLast = new Date(currentYear, currentMonth, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevMonthLast - i;
      days.push({
        day: d,
        isCurrentMonth: false,
        date: new Date(currentYear, currentMonth - 1, d),
      });
    }

    // Days of current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({
        day: d,
        isCurrentMonth: true,
        date: new Date(currentYear, currentMonth, d),
      });
    }

    // Fill remaining cells to complete grid (6 rows max)
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({
        day: d,
        isCurrentMonth: false,
        date: new Date(currentYear, currentMonth + 1, d),
      });
    }

    return days;
  }, [currentMonth, currentYear]);

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  function getDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function isToday(date: Date): boolean {
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  }

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={prevMonth}>
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only sm:ml-1">Prev</span>
        </Button>
        <h2 className="text-lg font-semibold">
          {monthLabels[currentMonth]} {currentYear}
        </h2>
        <Button variant="outline" size="sm" onClick={nextMonth}>
          <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[320px]">
          {/* Day of week headers */}
          <div className="grid grid-cols-7 gap-px">
            {dayLabels.map((label) => (
              <div
                key={label}
                className="py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px rounded-lg border bg-muted/30">
            {calendarDays.map((cell, idx) => {
              const dateKey = getDateKey(cell.date);
              const dayBookings = bookingsByDate.get(dateKey) || [];
              const hasBookings = dayBookings.length > 0;
              const isTodayCell = isToday(cell.date);

              const cellContent = (
                <div
                  className={cn(
                    "relative flex min-h-[60px] flex-col items-center p-1 sm:min-h-[80px] sm:p-2",
                    cell.isCurrentMonth
                      ? "bg-background"
                      : "bg-muted/20 text-muted-foreground/50",
                    isTodayCell && "ring-2 ring-primary ring-inset"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-sm",
                      isTodayCell && "bg-primary text-primary-foreground font-bold"
                    )}
                  >
                    {cell.day}
                  </span>
                  {hasBookings && (
                    <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                      {dayBookings.slice(0, 3).map((b) => (
                        <div
                          key={b.id}
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            getStatusDotColor(b.status)
                          )}
                        />
                      ))}
                      {dayBookings.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{dayBookings.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );

              if (!hasBookings) {
                return <div key={idx}>{cellContent}</div>;
              }

              return (
                <Popover key={idx}>
                  <PopoverTrigger asChild>
                    <button className="w-full cursor-pointer text-left transition-colors hover:bg-accent/50">
                      {cellContent}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-80 p-0"
                    align="center"
                    side="bottom"
                  >
                    <div className="border-b px-3 py-2">
                      <p className="text-sm font-medium">
                        {cell.date.toLocaleDateString(
                          locale === "de"
                            ? "de-DE"
                            : locale === "tr"
                              ? "tr-TR"
                              : locale === "fr"
                                ? "fr-FR"
                                : "en-GB",
                          {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          }
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dayBookings.length} appointment{dayBookings.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="max-h-60 divide-y overflow-y-auto">
                      {dayBookings.map((booking) => {
                        const doctorName = `${booking.doctor.title || ""} ${booking.doctor.profile.first_name} ${booking.doctor.profile.last_name}`.trim();
                        const startTime = new Date(booking.start_time);

                        return (
                          <Link
                            key={booking.id}
                            href={`/dashboard/bookings/${booking.id}`}
                            className="flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-accent/50"
                          >
                            <div className="flex-1 min-w-0 space-y-1">
                              <p className="text-sm font-medium truncate">
                                {doctorName}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3 shrink-0" />
                                {startTime.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                                <span className="inline-flex items-center gap-0.5">
                                  {booking.consultation_type === "video" ? (
                                    <Video className="h-3 w-3" />
                                  ) : (
                                    <User className="h-3 w-3" />
                                  )}
                                  {booking.consultation_type === "video"
                                    ? "Video"
                                    : "In Person"}
                                </span>
                              </div>
                            </div>
                            <Badge
                              variant={getStatusBadgeVariant(booking.status)}
                              className={cn(
                                "text-[10px] shrink-0",
                                getStatusColor(booking.status)
                              )}
                            >
                              {formatStatusLabel(booking.status)}
                            </Badge>
                          </Link>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          Confirmed
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
          Completed
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-yellow-500" />
          Pending
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-red-500" />
          Cancelled
        </div>
      </div>
    </div>
  );
}
