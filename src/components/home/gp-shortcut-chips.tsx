"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Building2, Clock, Stethoscope, Video } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getLiveAvailabilityCounts } from "@/actions/live-availability";
import {
  resolveGpLocalArea,
  resolveGpMarketCountry,
  type GpMarketLocation,
  type GpMarketPlace,
} from "@/lib/gp/market-country";

const GP_SLUG = "general-practice";

type ChipId = "see_today" | "available_now" | "in_person";

export type GpShortcutLocation = GpMarketLocation;
export type GpShortcutPlace = GpMarketPlace;

interface GpShortcutChipsProps {
  /** Server-rendered live count for general-practice (next hour) */
  initialGpCount?: number;
  /** Locations catalog (same as home search) for country / city resolution */
  locations?: GpShortcutLocation[];
  /** Selected Google Place from the home search bar */
  placeData?: GpShortcutPlace | null;
  /** Predefined location slug selected in search (city or country-xx) */
  locationSlug?: string;
  /** GPS coords when available */
  geo?: { latitude: number | null; longitude: number | null };
  /**
   * hero — translucent white pills on the gradient
   * dashboard — solid chips on light backgrounds
   */
  variant?: "hero" | "dashboard";
  className?: string;
}

function trackGpShortcutClick(
  chip: ChipId,
  meta: { countryCode: string; mode: "video" | "in_person" }
) {
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
      gp_country: meta.countryCode,
      gp_mode: meta.mode,
    });
    if (typeof w.gtag === "function") {
      w.gtag("event", "gp_shortcut_click", {
        chip,
        country: meta.countryCode,
        mode: meta.mode,
      });
    }
  } catch {
    // analytics is best-effort
  }
}

/**
 * One-tap shortcuts into GP search.
 *
 * - See a GP today / Available now → country-wide **video** GPs
 * - GP in person → **city / nearby only** (never country-wide)
 */
export function GpShortcutChips({
  initialGpCount = 0,
  locations = [],
  placeData = null,
  locationSlug = "",
  geo,
  variant = "hero",
  className,
}: GpShortcutChipsProps) {
  const t = useTranslations("home");
  const locale = useLocale();
  const router = useRouter();
  const [gpCount, setGpCount] = useState(initialGpCount);

  const countryCode = useMemo(
    () =>
      resolveGpMarketCountry({
        locale,
        locations,
        locationSlug,
        placeData,
        geo,
      }),
    [locale, locations, locationSlug, placeData, geo]
  );

  const localArea = useMemo(
    () =>
      resolveGpLocalArea({
        locations,
        locationSlug,
        placeData,
        geo,
      }),
    [locations, locationSlug, placeData, geo]
  );

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

  const goVideo = (chip: "see_today" | "available_now") => {
    trackGpShortcutClick(chip, { countryCode, mode: "video" });
    const params = new URLSearchParams();
    params.set("specialty", GP_SLUG);
    params.set("from", "gp_shortcut");
    params.set("availableToday", "true");
    params.set("location", `country-${countryCode.toLowerCase()}`);
    params.set("consultationType", "video");
    params.set("gpMarket", countryCode);
    if (chip === "available_now") {
      params.set("sort", "soonest");
    }
    router.push(`/doctors?${params.toString()}`);
  };

  const goInPerson = () => {
    if (localArea.kind === "missing") {
      toast.error(t("gp_shortcut_need_location"));
      return;
    }

    trackGpShortcutClick("in_person", { countryCode, mode: "in_person" });

    const params = new URLSearchParams();
    params.set("specialty", GP_SLUG);
    params.set("from", "gp_shortcut");
    params.set("availableToday", "true");
    params.set("consultationType", "in_person");
    params.set("sort", "soonest");

    if (localArea.kind === "place") {
      params.set("placeLat", localArea.placeLat.toFixed(6));
      params.set("placeLng", localArea.placeLng.toFixed(6));
      params.set("placeName", localArea.placeName);
      params.set("radius", String(localArea.radiusKm));
    } else {
      params.set("location", localArea.locationSlug);
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
      {/* Video — country-wide */}
      <button
        type="button"
        className={primaryChipClass}
        onClick={() => goVideo("see_today")}
      >
        <Stethoscope className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {t("gp_shortcut_see_today")}
      </button>

      {gpCount > 0 && (
        <button
          type="button"
          className={chipClass}
          onClick={() => goVideo("available_now")}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <Video className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("gp_shortcut_available_now_count", { count: gpCount })}
        </button>
      )}

      {/* In person — city / nearby only */}
      <button
        type="button"
        className={chipClass}
        onClick={goInPerson}
      >
        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {t("gp_shortcut_in_person")}
      </button>

      {variant === "dashboard" && (
        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden />
          {t("gp_shortcut_hint")}
        </span>
      )}
    </div>
  );
}
