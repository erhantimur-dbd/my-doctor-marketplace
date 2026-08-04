"use client";

import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
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
const LIVE_WINDOW_HOURS = 2;
const IN_PERSON_WINDOW_HOURS = 2;

type ChipId = "see_today" | "available_now" | "in_person" | "next_gp";

export type GpShortcutLocation = GpMarketLocation;
export type GpShortcutPlace = GpMarketPlace;

interface GpShortcutChipsProps {
  initialGpCount?: number;
  initialInPersonSlotCount?: number;
  locations?: GpShortcutLocation[];
  placeData?: GpShortcutPlace | null;
  locationSlug?: string;
  geo?: { latitude: number | null; longitude: number | null };
  variant?: "hero" | "dashboard";
  className?: string;
}

const FALLBACKS = {
  section: "Same Day Appointments Available:",
  seeToday: "Video GP today",
  seeTodayCount: (n: number) => `Video GP today · ${n} open`,
  seeTodayTitle: "Video GP appointments available today",
  nextGp: "Next GP Appointment",
  nextGpTitle: "No free slots left today — browse the next available GP appointment",
  availableNow: (n: number) => `Video GP · soon · ${n}`,
  availableNowTitle: "Video GPs with free appointments in the next 2 hours",
  inPerson: (n: number) => `In person nearby · ${n}`,
  inPersonTitle: "In-person GPs near you with free appointments in the next 2 hours",
  needLocation: "Choose a city or allow location to find in-person GPs nearby",
  hint: "Same-day video GPs",
} as const;

/** Catch render errors so the rest of the home search bar still works */
class ChipsErrorBoundary extends Component<
  { children: ReactNode; className?: string },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: unknown) {
    console.error("[GpShortcutChips] render error:", err);
  }

  render() {
    if (this.state.hasError) {
      // Minimal always-visible fallback chips (no i18n / server actions)
      return (
        <div
          className={cn(
            "flex flex-col items-center gap-2",
            this.props.className
          )}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-white/80">
            {FALLBACKS.section}
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-sm font-medium text-white">
            <span className="rounded-full bg-white px-3.5 py-2 text-primary">
              {FALLBACKS.nextGp}
            </span>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
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
    // ignore
  }
}

function useHomeT() {
  const t = useTranslations("home");
  return (key: string, fallback: string, values?: Record<string, number | string>) => {
    try {
      // next-intl throws or returns MISSING_MESSAGE depending on config
      const msg = values
        ? t(key as Parameters<typeof t>[0], values as never)
        : t(key as Parameters<typeof t>[0]);
      if (
        typeof msg === "string" &&
        (msg === key || msg.includes("MISSING_MESSAGE") || msg.startsWith("home."))
      ) {
        return fallback;
      }
      return msg;
    } catch {
      return fallback;
    }
  };
}

/**
 * One-tap GP shortcuts.
 * Primary chip always shows (today slots or "Next GP Appointment").
 * Secondary chips hide when their appointment count is zero.
 */
function GpShortcutChipsInner({
  initialGpCount = 0,
  initialInPersonSlotCount = 0,
  locations = [],
  placeData = null,
  locationSlug = "",
  geo,
  variant = "hero",
  className,
}: GpShortcutChipsProps) {
  const t = useHomeT();
  const locale = useLocale();
  const router = useRouter();

  const [gpCount, setGpCount] = useState(initialGpCount);
  const [todaySlotCount, setTodaySlotCount] = useState(0);
  const [inPersonDoctorCount, setInPersonDoctorCount] = useState(
    initialInPersonSlotCount
  );

  const countryCode = useMemo(() => {
    try {
      return resolveGpMarketCountry({
        locale,
        locations: locations || [],
        locationSlug,
        placeData,
        geo,
      });
    } catch {
      return "GB";
    }
  }, [locale, locations, locationSlug, placeData, geo]);

  const localArea = useMemo(() => {
    try {
      return resolveGpLocalArea({
        locations: locations || [],
        locationSlug,
        placeData,
        geo,
      });
    } catch {
      return { kind: "missing" as const };
    }
  }, [locations, locationSlug, placeData, geo]);

  const nearbyCoords = useMemo((): {
    lat: number;
    lng: number;
    radiusKm: number;
  } | null => {
    try {
      if (localArea.kind === "place") {
        return {
          lat: localArea.placeLat,
          lng: localArea.placeLng,
          radiusKm: localArea.radiusKm,
        };
      }
      if (localArea.kind === "city") {
        const city = (locations || []).find(
          (l) => l.slug === localArea.locationSlug
        );
        if (city?.latitude != null && city?.longitude != null) {
          return {
            lat: city.latitude,
            lng: city.longitude,
            radiusKm: GP_IN_PERSON_RADIUS_KM,
          };
        }
      }
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
    } catch {
      // ignore
    }
    return null;
  }, [localArea, locations, geo]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const [liveIds, todaySlots, inPerson] = await Promise.all([
          getLiveAvailableDoctorIds({
            specialtySlug: GP_SLUG,
            consultationType: "video",
            windowHours: LIVE_WINDOW_HOURS,
          }).catch(() => [] as string[]),
          getGpVideoTodaySlotCount({ countryCode }).catch(() => ({
            doctorCount: 0,
            slotCount: 0,
          })),
          nearbyCoords
            ? getGpInPersonAvailability({
                windowHours: IN_PERSON_WINDOW_HOURS,
                lat: nearbyCoords.lat,
                lng: nearbyCoords.lng,
                radiusKm: nearbyCoords.radiusKm,
              }).catch(() => ({
                doctorCount: 0,
                slotCount: 0,
                doctorIds: [] as string[],
              }))
            : Promise.resolve({
                doctorCount: 0,
                slotCount: 0,
                doctorIds: [] as string[],
              }),
        ]);
        if (!cancelled) {
          setGpCount(liveIds.length);
          setTodaySlotCount(todaySlots.slotCount);
          setInPersonDoctorCount(inPerson.doctorCount);
        }
      } catch (err) {
        console.error("[GpShortcutChips] poll failed:", err);
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
    const hasTodaySlots = todaySlotCount > 0;
    trackGpShortcutClick(
      chip === "see_today" && !hasTodaySlots ? "next_gp" : chip,
      { countryCode, mode: "video" }
    );
    const params = new URLSearchParams();
    params.set("specialty", GP_SLUG);
    params.set("from", "gp_shortcut");
    params.set("sort", "soonest");
    params.set("consultationType", "video");

    if (chip === "available_now") {
      params.set("liveNow", "true");
      params.set("liveWindowHours", String(LIVE_WINDOW_HOURS));
    } else if (hasTodaySlots) {
      params.set("availableToday", "true");
      params.set("location", `country-${countryCode.toLowerCase()}`);
      params.set("gpMarket", countryCode);
    } else {
      // Next GP Appointment: next 5 days, never same-day-only
      params.set("location", `country-${countryCode.toLowerCase()}`);
      params.set("gpMarket", countryCode);
      params.set("availableWithinDays", "5");
      // Explicitly ensure availableToday is not carried over
      params.delete("availableToday");
    }

    router.push(`/doctors?${params.toString()}`);
  };

  const goInPerson = () => {
    if (!nearbyCoords) {
      toast.error(
        t("gp_shortcut_need_location", FALLBACKS.needLocation)
      );
      return;
    }

    trackGpShortcutClick("in_person", { countryCode, mode: "in_person" });

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

  const hasTodaySlots = todaySlotCount > 0;
  // Prefer explicit FALLBACKS when empty so stale i18n never shows "Next video GP"
  const seeTodayLabel = hasTodaySlots
    ? t(
        "gp_shortcut_see_today_count",
        FALLBACKS.seeTodayCount(todaySlotCount),
        { count: todaySlotCount }
      )
    : FALLBACKS.nextGp;

  const availableNowLabel = t(
    "gp_shortcut_available_now_count",
    FALLBACKS.availableNow(gpCount),
    { count: gpCount }
  );

  const inPersonLabel = t(
    "gp_shortcut_in_person_count",
    FALLBACKS.inPerson(inPersonDoctorCount),
    { count: inPersonDoctorCount }
  );

  const sectionLabel = t(
    "gp_shortcut_section_label",
    FALLBACKS.section
  );

  return (
    <div
      className={cn("flex flex-col items-center gap-2", className)}
      data-testid="gp-shortcut-chips"
    >
      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-wide",
          variant === "hero"
            ? "text-white/80 drop-shadow-sm"
            : "text-muted-foreground"
        )}
      >
        {sectionLabel}
      </p>
      <div
        className="flex flex-wrap items-center justify-center gap-2"
        role="group"
        aria-label={sectionLabel}
      >
        <button
          type="button"
          className={primaryChipClass}
          onClick={() => goVideo("see_today")}
          title={
            hasTodaySlots
              ? t("gp_shortcut_see_today_title", FALLBACKS.seeTodayTitle)
              : t("gp_shortcut_next_gp_title", FALLBACKS.nextGpTitle)
          }
        >
          <Stethoscope className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {seeTodayLabel}
        </button>

        {gpCount > 0 && (
          <button
            type="button"
            className={chipClass}
            onClick={() => goVideo("available_now")}
            title={t(
              "gp_shortcut_available_now_title",
              FALLBACKS.availableNowTitle
            )}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <Video className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {availableNowLabel}
          </button>
        )}

        {inPersonDoctorCount > 0 && (
          <button
            type="button"
            className={chipClass}
            onClick={goInPerson}
            title={t("gp_shortcut_in_person_title", FALLBACKS.inPersonTitle)}
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {inPersonLabel}
          </button>
        )}
      </div>

      {variant === "dashboard" && (
        <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" aria-hidden />
          {t("gp_shortcut_hint", FALLBACKS.hint)}
        </span>
      )}
    </div>
  );
}

/** Public export — never blank out the home hero if chips throw */
export function GpShortcutChips(props: GpShortcutChipsProps) {
  return (
    <ChipsErrorBoundary className={props.className}>
      <GpShortcutChipsInner {...props} />
    </ChipsErrorBoundary>
  );
}
