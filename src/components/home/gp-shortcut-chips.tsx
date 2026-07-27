"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Clock, Stethoscope, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLiveAvailabilityCounts } from "@/actions/live-availability";

const GP_SLUG = "general-practice";

type ChipId = "see_today" | "available_now";

interface GpShortcutChipsProps {
  /** Server-rendered live count for general-practice (next hour) */
  initialGpCount?: number;
  /**
   * hero — translucent white pills on the gradient
   * dashboard — solid chips on light backgrounds
   */
  variant?: "hero" | "dashboard";
  className?: string;
}

function trackGpShortcutClick(chip: ChipId) {
  if (typeof window === "undefined") return;
  try {
    const w = window as Window & {
      gtag?: (...args: unknown[]) => void;
      dataLayer?: unknown[];
    };
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({
      event: "gp_shortcut_click",
      gp_shortcut_chip: chip,
    });
    if (typeof w.gtag === "function") {
      w.gtag("event", "gp_shortcut_click", { chip });
    }
  } catch {
    // analytics is best-effort
  }
}

/**
 * One-tap shortcuts into GP search.
 *
 * Important: live counts are marketplace-wide (any consultation type, no
 * location). Chip links must use the same scope — forcing video or the
 * home search location previously produced empty "no doctors" results
 * while the badge still showed a count.
 */
export function GpShortcutChips({
  initialGpCount = 0,
  variant = "hero",
  className,
}: GpShortcutChipsProps) {
  const t = useTranslations("home");
  const router = useRouter();
  const [gpCount, setGpCount] = useState(initialGpCount);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const counts = await getLiveAvailabilityCounts();
        if (!cancelled) setGpCount(counts[GP_SLUG] ?? 0);
      } catch {
        // keep last known count
      }
    };
    poll();
    const interval = setInterval(poll, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const go = (chip: ChipId) => {
    trackGpShortcutClick(chip);
    const params = new URLSearchParams();
    params.set("specialty", GP_SLUG);
    params.set("from", "gp_shortcut");

    if (chip === "see_today") {
      // Same-day GPs, any consultation type (matches real inventory)
      params.set("availableToday", "true");
    } else {
      // "Available now" badge = slots in the next hour (any type).
      // Prefer same-day list so users still see bookable GPs if the
      // next-hour set is already booked by the time they land.
      params.set("availableToday", "true");
      params.set("sort", "soonest");
    }

    router.push(`/doctors?${params.toString()}`);
  };

  const chipClass = cn(
    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    variant === "hero"
      ? "bg-white/15 text-white backdrop-blur-sm hover:bg-white/25 focus-visible:ring-white/60 focus-visible:ring-offset-transparent"
      : "border bg-background text-foreground shadow-sm hover:bg-muted focus-visible:ring-primary"
  );

  const primaryChipClass = cn(
    chipClass,
    variant === "hero"
      ? "bg-white text-primary hover:bg-white/90 font-semibold shadow-md"
      : "border-primary/30 bg-primary text-primary-foreground hover:bg-primary/90"
  );

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-2",
        className
      )}
      role="group"
      aria-label={t("gp_shortcut_aria")}
    >
      <button
        type="button"
        className={primaryChipClass}
        onClick={() => go("see_today")}
      >
        <Stethoscope className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {t("gp_shortcut_see_today")}
      </button>

      {gpCount > 0 && (
        <button
          type="button"
          className={chipClass}
          onClick={() => go("available_now")}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <Video className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("gp_shortcut_available_now_count", { count: gpCount })}
        </button>
      )}

      {variant === "dashboard" && (
        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden />
          {t("gp_shortcut_hint")}
        </span>
      )}
    </div>
  );
}
