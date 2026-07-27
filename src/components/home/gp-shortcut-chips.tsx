"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Building2, Clock, Stethoscope, Video } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  getGpInPersonAvailability,
  getGpVideoTodaySlotCount,
  getLiveAvailableDoctorIds,
} from "@/actions/live-availability";
import {
  GP_IN_PERSON_RADIUS_KM,
  resolveGpLocalArea,
  resolveGpMarketCountry,
  type GpMarketLocation,
  type GpMarketPlace,
} from "@/lib/gp/market-country";

const GP_SLUG = "general-practice";
/** Align video Available Now with in-person “soon” window */
const LIVE_WINDOW_HOURS = 2;
const IN_PERSON_WINDOW_HOURS = 2;

type ChipId = "see_today" | "available_now" | "in_person";

export type GpShortcutLocation = GpMarketLocation;
export type GpShortcutPlace = GpMarketPlace;

interface GpShortcutChipsProps {
  /** Server-rendered live count for general-practice (next hour) */
  initialGpCount?: number;
  /** Optional SSR seed for in-person slot count (next 2h) */
  initialInPersonSlotCount?: number;
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
 * - See a GP today → country-wide **video**; chip shows total **open appointments today**
 * - Available now → video GPs with free slots in next 2h (**doctor** count)
 * - In person nearby → **doctor** count within 10km / 2h
 */
export function GpShortcutChips({
  initialGpCount = 0,
  initialInPersonSlotCount = 0,
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
  /** Available now — doctors with video slots in next 2h */
  const [gpCount, setGpCount] = useState(initialGpCount);
  /** See a GP today — total free video appointment slots remaining today */
  const [todaySlotCount, setTodaySlotCount] = useState(0);
  /** In person nearby — doctors (not slots) */
  const [inPersonDoctorCount, setInPersonDoctorCount] = useState(
    initialInPersonSlotCount
  );

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

  // Nearby-only coords for in-person live count (never country-wide)
  const nearbyCoords = useMemo((): {
    lat: number;
    lng: number;
    radiusKm: number;
  } | null => {
    if (localArea.kind === "place") {
      return {
        lat: localArea.placeLat,
        lng: localArea.placeLng,
        radiusKm: localArea.radiusKm,
      };
    }
    if (localArea.kind === "city") {
      const city = locations.find((l) => l.slug === localArea.locationSlug);
      if (city?.latitude != null && city?.longitude != null) {
        return {
          lat: city.latitude,
          lng: city.longitude,
          radiusKm: GP_IN_PERSON_RADIUS_KM,
        };
      }
    }
    // GPS without resolved city still counts as nearby
    if (
      geo?.latitude != null &&
      geo?.longitude != null &&
      Number.isFinite(geo.latitude) &&
      Number.isFinite(geo.longitude)
    ) {
      return {
        lat: geo.latitude,
        lng: geo.longitude,
        radiusKm: GP_IN_PERSON_RADIUS_KM,
      };
    }
    return null;
  }, [localArea, locations, geo]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        // Video Available Now = GPs who offer video with free slots in 2h
        const liveIdsPromise = getLiveAvailableDoctorIds({
          specialtySlug: GP_SLUG,
          consultationType: "video",
          windowHours: LIVE_WINDOW_HOURS,
        });

        // See a GP today = total free video appointments left today (country)
        const todaySlotsPromise = getGpVideoTodaySlotCount({
          countryCode,
        });

        // In-person counter is nearby-only — skip RPC until we have lat/lng
        const inPersonPromise = nearbyCoords
          ? getGpInPersonAvailability({
              windowHours: IN_PERSON_WINDOW_HOURS,
              lat: nearbyCoords.lat,
              lng: nearbyCoords.lng,
              radiusKm: nearbyCoords.radiusKm,
            })
          : Promise.resolve({
              doctorCount: 0,
              slotCount: 0,
              doctorIds: [] as string[],
            });

        const [liveIds, todaySlots, inPerson] = await Promise.all([
          liveIdsPromise,
          todaySlotsPromise,
          inPersonPromise,
        ]);
        if (!cancelled) {
          setGpCount(liveIds.length);
          setTodaySlotCount(todaySlots.slotCount);
          setInPersonDoctorCount(inPerson.doctorCount);
        }
      } catch {
        // keep last known counts
      }
    };
    poll();
    const interval = setInterval(poll, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [nearbyCoords, countryCode]);

  const goVideo = (chip: "see_today" | "available_now") => {
    trackGpShortcutClick(chip, { countryCode, mode: "video" });
    const params = new URLSearchParams();
    params.set("specialty", GP_SLUG);
    params.set("from", "gp_shortcut");
    params.set("sort", "soonest");
    params.set("consultationType", "video");

    if (chip === "available_now") {
      // Exact same filter as the live count: video GPs with free slots in 2h
      params.set("liveNow", "true");
      params.set("liveWindowHours", String(LIVE_WINDOW_HOURS));
    } else {
      // Same-day video GPs in the patient's market country
      params.set("availableToday", "true");
      params.set("location", `country-${countryCode.toLowerCase()}`);
      params.set("gpMarket", countryCode);
    }

    router.push(`/doctors?${params.toString()}`);
  };

  const goInPerson = () => {
    if (!nearbyCoords) {
      toast.error(t("gp_shortcut_need_location"));
      return;
    }

    trackGpShortcutClick("in_person", { countryCode, mode: "in_person" });

    // Same nearby live set as the counter (doctors with free in-person slots in 2h)
    const params = new URLSearchParams();
    params.set("specialty", GP_SLUG);
    params.set("from", "gp_shortcut");
    params.set("consultationType", "in_person");
    params.set("sort", "soonest");
    params.set("liveInPersonNearby", "true");
    params.set("liveWindowHours", String(IN_PERSON_WINDOW_HOURS));
    params.set("placeLat", nearbyCoords.lat.toFixed(6));
    params.set("placeLng", nearbyCoords.lng.toFixed(6));
    params.set("radius", String(nearbyCoords.radiusKm));
    params.set(
      "placeName",
      localArea.kind === "place"
        ? localArea.placeName
        : localArea.kind === "city"
          ? localArea.locationSlug
          : "Nearby"
    );

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

  const seeTodayLabel =
    todaySlotCount > 0
      ? t("gp_shortcut_see_today_count", { count: todaySlotCount })
      : t("gp_shortcut_see_today");

  const inPersonLabel =
    inPersonDoctorCount > 0
      ? t("gp_shortcut_in_person_count", { count: inPersonDoctorCount })
      : t("gp_shortcut_in_person");

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-wide",
          variant === "hero"
            ? "text-white/80 drop-shadow-sm"
            : "text-muted-foreground"
        )}
      >
        {t("gp_shortcut_section_label")}
      </p>
      <div
        className="flex flex-wrap items-center justify-center gap-2"
        role="group"
        aria-label={t("gp_shortcut_section_label")}
      >
        {/* Video today — country-wide; count = open appointments (slots) */}
        <button
          type="button"
          className={primaryChipClass}
          onClick={() => goVideo("see_today")}
          title={t("gp_shortcut_see_today_title")}
        >
          <Stethoscope className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {seeTodayLabel}
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

        {/* In person — city / nearby only; live slot count next 2h */}
        <button
          type="button"
          className={chipClass}
          onClick={goInPerson}
          title={t("gp_shortcut_in_person_title")}
        >
          {inPersonDoctorCount > 0 && (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
          )}
          <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {inPersonLabel}
        </button>
      </div>

      {variant === "dashboard" && (
        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden />
          {t("gp_shortcut_hint")}
        </span>
      )}
    </div>
  );
}
