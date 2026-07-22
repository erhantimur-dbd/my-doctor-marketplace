"use client";

import { useTranslations, useLocale } from "next-intl";
import {
  CalendarDays,
  Clock,
  MapPin,
  Shield,
  Video,
  User,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { formatBookTimeParam } from "@/lib/chat/booking-href";
import type { BookingAuthContext } from "@/lib/auth/booking-context";
import { cn } from "@/lib/utils";

interface BookingAuthSummaryProps {
  context: BookingAuthContext;
  mode: "sign-up" | "sign-in";
  className?: string;
}

export function BookingAuthSummary({
  context,
  mode,
  className,
}: BookingAuthSummaryProps) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const { doctor, book } = context;

  const timeLabel = formatBookTimeParam(book.time);
  const typeLabel =
    book.type === "video"
      ? t("booking_type_video")
      : book.type === "in_person"
        ? t("booking_type_in_person")
        : null;

  let dateLabel: string | null = null;
  if (book.date) {
    try {
      dateLabel = new Intl.DateTimeFormat(locale, {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(book.date + "T12:00:00"));
    } catch {
      dateLabel = book.date;
    }
  }

  const initials = doctor.name
    .replace(/^(Dr\.?|Prof\.?)\s+/i, "")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const locationStr = [doctor.city, doctor.countryCode]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      data-booking-auth
      className={cn(
        "mb-4 overflow-hidden rounded-xl border border-primary/20 bg-background shadow-sm md:mb-0",
        className
      )}
    >
      <div className="bg-primary/10 px-4 py-3 text-sm font-medium text-primary">
        {mode === "sign-up"
          ? t("booking_banner_sign_up")
          : t("booking_banner_sign_in")}
      </div>

      {/* Column-friendly layout: avatar + identity stacked on wide sidebar */}
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start md:flex-col">
        <div className="flex gap-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-background">
            {doctor.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={doctor.avatarUrl}
                alt={doctor.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-muted-foreground">
                {initials || <User className="h-5 w-5" />}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{doctor.name}</p>
            {doctor.specialtyDisplay && (
              <p className="text-sm text-muted-foreground">
                {doctor.specialtyDisplay}
              </p>
            )}
            {locationStr && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span>{locationStr}</span>
              </p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {doctor.isVerified && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Shield className="h-2.5 w-2.5" />
                  {t("booking_verified")}
                </span>
              )}
              {doctor.consultationTypes?.includes("video") && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                  <Video className="h-2.5 w-2.5" />
                  {t("booking_type_video")}
                </span>
              )}
            </div>
          </div>
        </div>

        {doctor.consultationFeeCents > 0 && (
          <div className="rounded-lg bg-muted/50 px-3 py-2 sm:ml-auto sm:text-right md:ml-0 md:text-left">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {t("booking_from")}
            </p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {formatCurrency(
                doctor.consultationFeeCents,
                doctor.currency,
                locale
              )}
            </p>
          </div>
        )}
      </div>

      {(dateLabel || timeLabel || typeLabel) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t bg-muted/40 px-5 py-3 text-xs text-foreground">
          {typeLabel && (
            <span className="inline-flex items-center gap-1 font-medium">
              {book.type === "video" ? (
                <Video className="h-3.5 w-3.5 text-purple-600" />
              ) : (
                <User className="h-3.5 w-3.5 text-primary" />
              )}
              {typeLabel}
            </span>
          )}
          {dateLabel && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              {dateLabel}
            </span>
          )}
          {timeLabel && (
            <span className="inline-flex items-center gap-1 font-medium text-primary">
              <Clock className="h-3.5 w-3.5" />
              {timeLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
