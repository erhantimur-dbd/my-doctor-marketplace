"use client";

import { Link } from "@/i18n/navigation";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  MapPin,
  CalendarDays,
  Shield,
  Video,
  Heart,
  User,
  UserCircle,
} from "lucide-react";
import { StarRating } from "@/components/shared/star-rating";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import { useChatStore, SHORTLIST_LIMIT } from "@/stores/chat-store";
import { useUser } from "@/hooks/use-user";
import { getAuthedHref } from "@/lib/chat/booking-href";
import type { ChatDoctor, ChatDoctorSlot } from "@/lib/chat/tools";

interface ChatDoctorCardProps {
  doctor: ChatDoctor;
  locale: string;
  onBook?: () => void;
}

export function ChatDoctorCard({ doctor, locale, onBook }: ChatDoctorCardProps) {
  const t = useTranslations("chat.card");
  const shortlist = useChatStore((s) => s.shortlist);
  const toggleShortlist = useChatStore((s) => s.toggleShortlist);
  const saved = shortlist.some((d) => d.id === doctor.id);
  const atLimit = !saved && shortlist.length >= SHORTLIST_LIMIT;
  const { user } = useUser();
  const isAuthenticated = !!user;
  const bookHref = getAuthedHref(`/doctors/${doctor.slug}/book`, {
    isAuthenticated,
    locale,
  });

  const initials = doctor.name
    .replace(/^(Dr\.?|Prof\.?)\s+/i, "")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      <button
        type="button"
        onClick={() => {
          if (atLimit) return;
          toggleShortlist(doctor);
        }}
        disabled={atLimit}
        aria-label={saved ? t("remove_from_shortlist") : t("add_to_shortlist")}
        title={
          atLimit
            ? t("shortlist_full", { limit: SHORTLIST_LIMIT })
            : saved
              ? t("remove_from_shortlist")
              : t("add_to_shortlist")
        }
        className={cn(
          "absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border transition-all",
          saved
            ? "border-red-200 bg-red-50 text-red-500 dark:border-red-900/40 dark:bg-red-950/30"
            : "border-border bg-background/80 text-muted-foreground backdrop-blur hover:border-primary/30 hover:text-primary",
          atLimit && "cursor-not-allowed opacity-40"
        )}
      >
        <Heart className={cn("h-4 w-4", saved && "fill-current")} />
      </button>

      <div className="flex flex-col items-center p-4 pt-4 text-center">
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

        <Link
          href={`/doctors/${doctor.slug}`}
          onClick={onBook}
          className="mt-3 text-base font-semibold text-primary hover:underline"
        >
          {doctor.name}
        </Link>

        {doctor.specialtyDisplay && (
          <p className="mt-0.5 text-sm text-foreground">
            {doctor.specialtyDisplay}
          </p>
        )}

        {doctor.city && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span>
              {doctor.city}
              {doctor.countryCode ? `, ${doctor.countryCode}` : ""}
            </span>
          </div>
        )}

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

      {(doctor.slotsByType.in_person.length > 0 ||
        doctor.slotsByType.video.length > 0) && (
        <div className="flex flex-col gap-2.5 border-t border-border px-4 py-3">
          {doctor.slotsByType.in_person.length > 0 && (
            <SlotRow
              icon={<User className="h-3 w-3 text-primary" />}
              label={t("next_available_in_person", {
                date: formatRelativeDate(
                  doctor.slotsByType.in_person[0].date,
                  locale
                ),
              })}
              slots={doctor.slotsByType.in_person}
              doctorSlug={doctor.slug}
              locale={locale}
              isAuthenticated={isAuthenticated}
              onBook={onBook}
            />
          )}
          {doctor.slotsByType.video.length > 0 && (
            <SlotRow
              icon={<Video className="h-3 w-3 text-purple-600" />}
              label={t("next_available_video", {
                date: formatRelativeDate(
                  doctor.slotsByType.video[0].date,
                  locale
                ),
              })}
              slots={doctor.slotsByType.video}
              doctorSlug={doctor.slug}
              locale={locale}
              isAuthenticated={isAuthenticated}
              onBook={onBook}
              variant="video"
            />
          )}
        </div>
      )}

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
        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/doctors/${doctor.slug}`}
            onClick={onBook}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-background px-3 py-2.5 text-xs font-semibold text-primary",
              "hover:bg-primary/5 transition-colors"
            )}
          >
            <UserCircle className="h-4 w-4" />
            {t("view_profile")}
          </Link>
          <Link
            href={bookHref}
            onClick={onBook}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm",
              "hover:bg-primary/90 transition-colors"
            )}
          >
            <CalendarDays className="h-4 w-4" />
            {t("book_appointment")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function SlotRow({
  icon,
  label,
  slots,
  doctorSlug,
  locale,
  isAuthenticated,
  onBook,
  variant = "in_person",
}: {
  icon: React.ReactNode;
  label: string;
  slots: ChatDoctorSlot[];
  doctorSlug: string;
  locale: string;
  isAuthenticated: boolean;
  onBook?: () => void;
  variant?: "in_person" | "video";
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
        {icon}
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {slots.map((slot) => (
          <SlotPill
            key={`${slot.date}-${slot.start}`}
            doctorSlug={doctorSlug}
            slot={slot}
            locale={locale}
            isAuthenticated={isAuthenticated}
            onBook={onBook}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}

function SlotPill({
  doctorSlug,
  slot,
  locale,
  isAuthenticated,
  onBook,
  variant = "in_person",
}: {
  doctorSlug: string;
  slot: ChatDoctorSlot;
  locale: string;
  isAuthenticated: boolean;
  onBook?: () => void;
  variant?: "in_person" | "video";
}) {
  const startTime = slot.start.slice(11, 16);
  const slotPath = `/doctors/${doctorSlug}/book?date=${slot.date}&time=${encodeURIComponent(slot.start)}&type=${slot.consultationType}`;
  const href = getAuthedHref(slotPath, { isAuthenticated, locale });
  return (
    <Link
      href={href}
      onClick={onBook}
      className={cn(
        "inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
        variant === "video"
          ? "border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-600 hover:text-white dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-300"
          : "border-primary/25 bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground"
      )}
    >
      {startTime}
    </Link>
  );
}

function formatRelativeDate(isoDate: string, locale: string): string {
  const date = new Date(isoDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date) + " (today)";
  if (diffDays === 1) return "tomorrow";
  if (diffDays < 7) return new Intl.DateTimeFormat(locale, { weekday: "long" }).format(date);
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(date);
}
