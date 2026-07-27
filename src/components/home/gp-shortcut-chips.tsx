"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Clock, MapPin, Stethoscope, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLiveAvailabilityCounts } from "@/actions/live-availability";

const GP_SLUG = "general-practice";
const NEAR_ME_RADIUS_KM = "30";

type ChipId = "see_today" | "available_now" | "near_me";

export interface GpShortcutPlace {
  lat: number;
  lng: number;
  name: string;
}

interface GpShortcutChipsProps {
  /** Server-rendered live count for general-practice (next hour) */
  initialGpCount?: number;
  /** Selected Google Place from the home search bar */
  placeData?: GpShortcutPlace | null;
  /** Predefined location slug (city) when no place is selected */
  locationSlug?: string;
  /** GPS coords when available (for Near me without an explicit place) */
  geo?: { latitude: number | null; longitude: number | null };
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
 * One-tap shortcuts into same-day GP search.
 * Video-first for “See a GP today” / “Available now”; location-aware for “Near me”.
 */
export function GpShortcutChips({
  initialGpCount = 0,
  placeData = null,
  locationSlug = "",
  geo,
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

  const hasPlace = !!placeData;
  const hasLocationSlug = !!locationSlug && locationSlug !== "all";
  const hasGeo =
    geo?.latitude != null &&
    geo?.longitude != null &&
    Number.isFinite(geo.latitude) &&
    Number.isFinite(geo.longitude);
  const showNearMe = hasPlace || hasLocationSlug || hasGeo;

  const buildParams = (opts: {
    video?: boolean;
    includeLocation?: boolean;
  }) => {
    const params = new URLSearchParams();
    params.set("specialty", GP_SLUG);
    params.set("availableToday", "true");
    if (opts.video) params.set("consultationType", "video");
    params.set("from", "gp_shortcut");

    if (opts.includeLocation) {
      if (placeData) {
        params.set("placeLat", placeData.lat.toFixed(6));
        params.set("placeLng", placeData.lng.toFixed(6));
        params.set("placeName", placeData.name);
        params.set("radius", NEAR_ME_RADIUS_KM);
      } else if (hasGeo && geo) {
        params.set("placeLat", geo.latitude!.toFixed(6));
        params.set("placeLng", geo.longitude!.toFixed(6));
        params.set("placeName", t("gp_shortcut_near_me"));
        params.set("radius", NEAR_ME_RADIUS_KM);
      } else if (hasLocationSlug) {
        params.set("location", locationSlug);
      }
    } else if (placeData) {
      // Still pass location on video shortcuts when user already set one
      params.set("placeLat", placeData.lat.toFixed(6));
      params.set("placeLng", placeData.lng.toFixed(6));
      params.set("placeName", placeData.name);
      params.set("radius", NEAR_ME_RADIUS_KM);
    } else if (hasLocationSlug) {
      params.set("location", locationSlug);
    }

    return params;
  };

  const go = (chip: ChipId, params: URLSearchParams) => {
    trackGpShortcutClick(chip);
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
        onClick={() => go("see_today", buildParams({ video: true }))}
      >
        <Stethoscope className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {t("gp_shortcut_see_today")}
      </button>

      {gpCount > 0 && (
        <button
          type="button"
          className={chipClass}
          onClick={() => go("available_now", buildParams({ video: true }))}
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <Video className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("gp_shortcut_available_now_count", { count: gpCount })}
        </button>
      )}

      {showNearMe && (
        <button
          type="button"
          className={chipClass}
          onClick={() =>
            go(
              "near_me",
              buildParams({ video: false, includeLocation: true })
            )
          }
        >
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("gp_shortcut_near_me")}
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
