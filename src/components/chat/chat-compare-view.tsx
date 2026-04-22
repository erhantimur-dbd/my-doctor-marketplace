"use client";

import Image from "next/image";
import {
  ArrowLeft,
  MapPin,
  Shield,
  Star,
  Video,
  User,
  X,
  CalendarDays,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useChatStore } from "@/stores/chat-store";
import { useUser } from "@/hooks/use-user";
import { getAuthedHref } from "@/lib/chat/booking-href";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";

interface ChatCompareViewProps {
  locale: string;
  onClose: () => void;
  onBook?: () => void;
  variant?: "compact" | "expanded";
}

/**
 * Side-by-side comparison of shortlisted doctors, rendered as an overlay
 * within the chat window body. Covers messages while open. Fully client-side
 * — reads ChatDoctor objects from the store (no new API call).
 */
export function ChatCompareView({
  locale,
  onClose,
  onBook,
  variant = "compact",
}: ChatCompareViewProps) {
  const t = useTranslations("chat.compare");
  const tCard = useTranslations("chat.card");
  const shortlist = useChatStore((s) => s.shortlist);
  const removeFromShortlist = useChatStore((s) => s.removeFromShortlist);
  const { user } = useUser();
  const isAuthenticated = !!user;

  if (shortlist.length < 2) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-muted-foreground">{t("need_two")}</p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <ArrowLeft className="h-3 w-3" />
          {t("back")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/20 px-4 py-2.5">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("back")}
        </button>
        <p className="text-xs font-semibold text-foreground">
          {t("title", { count: shortlist.length })}
        </p>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-auto">
        <div
          className={cn(
            "grid gap-3 p-3",
            variant === "expanded" ? "sm:p-5" : "",
            shortlist.length === 2 ? "grid-cols-2" : "grid-cols-3"
          )}
        >
          {shortlist.map((doctor) => {
            const initials = doctor.name
              .replace(/^(Dr\.?|Prof\.?)\s+/i, "")
              .split(/\s+/)
              .map((p) => p[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase();

            return (
              <div
                key={doctor.id}
                className="relative flex flex-col overflow-hidden rounded-xl border border-border bg-background"
              >
                <button
                  type="button"
                  onClick={() => removeFromShortlist(doctor.id)}
                  aria-label={tCard("remove_from_shortlist")}
                  className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 text-muted-foreground backdrop-blur hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>

                <div className="flex flex-col items-center gap-1.5 px-3 pb-2 pt-4 text-center">
                  <div className="relative h-14 w-14 overflow-hidden rounded-full ring-2 ring-background shadow-sm">
                    {doctor.avatarUrl ? (
                      <Image
                        src={doctor.avatarUrl}
                        alt={doctor.name}
                        fill
                        sizes="56px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 text-xs font-semibold text-primary/70">
                        {initials || "Dr"}
                      </div>
                    )}
                  </div>
                  <Link
                    href={`/doctors/${doctor.slug}`}
                    onClick={onBook}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    {doctor.name}
                  </Link>
                  {doctor.specialtyDisplay && (
                    <p className="text-[11px] text-muted-foreground">
                      {doctor.specialtyDisplay}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2 border-t border-border px-3 py-2.5 text-[11px]">
                  <CompareRow
                    label={t("fee")}
                    value={formatCurrency(
                      doctor.consultationFeeCents,
                      doctor.currency,
                      locale
                    )}
                  />
                  <CompareRow
                    icon={<Star className="h-3 w-3 text-amber-500" />}
                    label={t("rating")}
                    value={
                      doctor.rating > 0
                        ? `${doctor.rating.toFixed(1)} (${doctor.reviewCount})`
                        : "—"
                    }
                  />
                  <CompareRow
                    icon={<MapPin className="h-3 w-3" />}
                    label={t("location")}
                    value={doctor.city || "—"}
                  />
                  <CompareRow
                    label={t("languages")}
                    value={
                      doctor.languages.length > 0
                        ? doctor.languages.slice(0, 3).join(", ")
                        : "—"
                    }
                  />
                  <CompareRow
                    icon={<Video className="h-3 w-3 text-purple-600" />}
                    label={t("video")}
                    value={
                      doctor.consultationTypes.includes("video")
                        ? t("yes")
                        : t("no")
                    }
                  />
                  <CompareRow
                    icon={<Shield className="h-3 w-3 text-green-600" />}
                    label={t("verified")}
                    value={doctor.isVerified ? t("yes") : t("no")}
                  />
                  <CompareRow
                    icon={<User className="h-3 w-3 text-primary" />}
                    label={t("next_in_person")}
                    value={
                      doctor.slotsByType.in_person[0]
                        ? doctor.slotsByType.in_person[0].start.slice(11, 16)
                        : "—"
                    }
                  />
                  <CompareRow
                    icon={<Video className="h-3 w-3 text-purple-600" />}
                    label={t("next_video")}
                    value={
                      doctor.slotsByType.video[0]
                        ? doctor.slotsByType.video[0].start.slice(11, 16)
                        : "—"
                    }
                  />
                </div>

                <Link
                  href={getAuthedHref(`/doctors/${doctor.slug}/book`, {
                    isAuthenticated,
                    locale,
                  })}
                  onClick={onBook}
                  className="m-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  <CalendarDays className="h-3 w-3" />
                  {tCard("book_appointment")}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CompareRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
