"use client";

import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { MapPin, CalendarDays, Shield, Video } from "lucide-react";
import { StarRating } from "@/components/shared/star-rating";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { ChatDoctor } from "@/lib/chat/tools";

interface ChatDoctorCardProps {
  doctor: ChatDoctor;
  locale: string;
  onBook?: () => void;
}

/**
 * Compact doctor tile rendered inline inside the chat window.
 * Matches the visual density of the competitor's chat card — avatar,
 * name, specialty, location, rating, "expert in" chips, Book button.
 *
 * Intentionally NOT the full `DoctorCard` component — that card is too
 * wide and has too much chrome (availability grid, compare, favorite) for
 * a narrow chat panel. This is a purpose-built slim variant.
 */
export function ChatDoctorCard({ doctor, locale, onBook }: ChatDoctorCardProps) {
  const t = useTranslations("chat.card");
  const initials = doctor.name
    .replace(/^(Dr\.?|Prof\.?)\s+/i, "")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      <div className="flex flex-col items-center p-4 text-center">
        {/* Avatar */}
        <div className="relative h-20 w-20 overflow-hidden rounded-full ring-2 ring-background shadow-sm">
          {doctor.avatarUrl ? (
            <Image
              src={doctor.avatarUrl}
              alt={doctor.name}
              fill
              sizes="80px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 text-base font-semibold text-primary/70">
              {initials || "Dr"}
            </div>
          )}
        </div>

        {/* Name */}
        <Link
          href={`/doctors/${doctor.slug}`}
          className="mt-3 text-base font-semibold text-primary hover:underline"
        >
          {doctor.name}
        </Link>

        {/* Specialty */}
        {doctor.specialtyDisplay && (
          <p className="mt-0.5 text-sm text-foreground">
            {doctor.specialtyDisplay}
          </p>
        )}

        {/* Location */}
        {doctor.city && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span>
              {doctor.city}
              {doctor.countryCode ? `, ${doctor.countryCode}` : ""}
            </span>
          </div>
        )}

        {/* Rating */}
        {doctor.rating > 0 && (
          <div className="mt-1.5">
            <StarRating
              rating={doctor.rating}
              totalReviews={doctor.reviewCount}
              size="sm"
              showCount
            />
          </div>
        )}

        {/* Verified + Video badges */}
        <div className="mt-1.5 flex items-center gap-3 text-[11px]">
          {doctor.isVerified && (
            <span className="flex items-center gap-1 text-green-600">
              <Shield className="h-3 w-3" />
              {t("verified")}
            </span>
          )}
          {doctor.consultationTypes.includes("video") && (
            <span className="flex items-center gap-1 text-purple-600">
              <Video className="h-3 w-3" />
              {t("video")}
            </span>
          )}
        </div>
      </div>

      {/* Expert in / related specialties */}
      {doctor.relatedSpecialties.length > 0 && (
        <div className="px-4 pb-3 text-left">
          <p className="mb-1.5 text-xs font-semibold text-foreground">
            {t("expert_in")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {doctor.relatedSpecialties.map((spec) => (
              <span
                key={spec}
                className="inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-foreground"
              >
                {spec}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Price + Book CTA */}
      <div className="border-t border-border bg-muted/20 px-4 py-3">
        <div className="mb-2 flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">{t("from")}</span>
          <span className="text-sm font-semibold text-foreground">
            {formatCurrency(
              doctor.consultationFeeCents,
              doctor.currency,
              locale
            )}
          </span>
        </div>
        <Link
          href={`/doctors/${doctor.slug}/book`}
          onClick={onBook}
          className={cn(
            "flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm",
            "hover:bg-primary/90 transition-colors"
          )}
        >
          <CalendarDays className="h-4 w-4" />
          {t("book_appointment")}
        </Link>
      </div>
    </div>
  );
}
