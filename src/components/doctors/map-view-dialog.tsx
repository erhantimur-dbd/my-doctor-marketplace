"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Maximize2, X, Monitor, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { CompactDoctorCard } from "./compact-doctor-card";
import { DoctorCard } from "./doctor-card";
import type { MapDoctor } from "@/components/maps/doctor-map";
import type { DoctorMultiDayAvailability } from "@/actions/search";
import { cn, formatSpecialtyName } from "@/lib/utils";

// Dynamic import — Google Maps requires window
const DoctorMap = dynamic(
  () => import("@/components/maps/doctor-map").then((mod) => mod.DoctorMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-muted/30 rounded-lg animate-pulse">
        <span className="text-sm text-muted-foreground">Loading map...</span>
      </div>
    ),
  }
);

type Doctor = Parameters<typeof DoctorCard>[0]["doctor"];

interface MapViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctors: Doctor[];
  locale: string;
  availability?: Record<string, DoctorMultiDayAvailability>;
  centerLocation?: { lat: number; lng: number; city: string; countryCode?: string };
  liveAvailability?: Record<string, boolean>;
}

function MapViewDialog({
  open,
  onOpenChange,
  doctors,
  locale,
  availability,
  centerLocation,
  liveAvailability = {},
}: MapViewDialogProps) {
  const t = useTranslations("search");
  const [hoveredDoctorId, setHoveredDoctorId] = useState<string | null>(null);
  const [consultationFilter, setConsultationFilter] = useState<"all" | "in_person" | "video">("all");
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Filter doctors by consultation type
  const filteredDoctors = useMemo(() => {
    if (consultationFilter === "all") return doctors;
    return doctors.filter((d) =>
      d.consultation_types?.includes(consultationFilter)
    );
  }, [doctors, consultationFilter]);

  // Build map-friendly data from doctors with coordinates
  const mapDoctors: MapDoctor[] = useMemo(() => {
    return filteredDoctors
      .filter((d) => {
        const doc: any = d;
        const loc: any = Array.isArray(d.location) ? d.location[0] : d.location;
        return (
          (doc.clinic_latitude != null && doc.clinic_longitude != null) ||
          (loc && loc.latitude != null && loc.longitude != null)
        );
      })
      .map((d) => {
        const doc: any = d;
        const loc: any = Array.isArray(d.location) ? d.location[0] : d.location;
        const primarySpec =
          d.specialties?.find((s) => s.is_primary)?.specialty ||
          d.specialties?.[0]?.specialty;
        const isLocal = centerLocation?.countryCode
          ? loc?.country_code === centerLocation.countryCode
          : true;
        const lat =
          doc.clinic_latitude != null
            ? Number(doc.clinic_latitude)
            : Number(loc.latitude);
        const lng =
          doc.clinic_longitude != null
            ? Number(doc.clinic_longitude)
            : Number(loc.longitude);
        return {
          id: d.id,
          slug: d.slug,
          name: `${d.title || ""} ${d.profile.first_name} ${d.profile.last_name}`.trim(),
          specialty: primarySpec
            ? formatSpecialtyName(primarySpec.name_key)
            : "",
          lat,
          lng,
          isLocal,
          liveAvailable: !!liveAvailability[d.id],
        };
      });
  }, [filteredDoctors, centerLocation, liveAvailability]);

  const handleClickDoctor = useCallback((id: string) => {
    const el = cardRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHoveredDoctorId(id);
      setTimeout(() => setHoveredDoctorId(null), 2000);
    }
  }, []);

  const setCardRef = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      if (el) {
        cardRefs.current.set(id, el);
      } else {
        cardRefs.current.delete(id);
      }
    },
    []
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[100vw] sm:max-w-[96vw] w-[100vw] sm:w-[96vw] h-[100dvh] sm:h-[90vh] p-0 gap-0 overflow-hidden rounded-none sm:rounded-lg"
        showCloseButton={false}
      >
        {/* Visually hidden title for a11y */}
        <DialogTitle className="sr-only">
          {t("map_view")}
        </DialogTitle>

        {/* Mobile: map on top + list below; Desktop: side-by-side */}
        <div className="flex h-full min-h-0 flex-col overflow-hidden md:flex-row">
          {/* Map panel — primary on mobile */}
          <div className="relative min-h-[45dvh] flex-1 overflow-hidden md:min-h-0">
            <DoctorMap
              doctors={mapDoctors}
              hoveredDoctorId={hoveredDoctorId}
              onHoverDoctor={setHoveredDoctorId}
              onClickDoctor={handleClickDoctor}
              centerLocation={centerLocation}
            />
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="absolute top-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-lg bg-white shadow-md border border-gray-200 hover:bg-gray-50 transition-colors"
              aria-label="Close map view"
            >
              <X className="h-5 w-5 text-gray-700" />
            </button>
          </div>

          {/* Card list — bottom sheet style on mobile */}
          <div className="flex max-h-[55dvh] min-h-0 w-full flex-col border-t md:max-h-none md:w-[32%] md:border-t-0 md:border-r md:order-first overflow-hidden">
            <div className="sticky top-0 z-10 shrink-0 bg-background border-b px-3 py-2.5 sm:px-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("doctors_on_map", { count: filteredDoctors.length })}
                </p>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[11px] font-medium self-start">
                  <button
                    type="button"
                    onClick={() => setConsultationFilter("all")}
                    className={cn(
                      "px-2.5 py-1.5 transition-colors",
                      consultationFilter === "all"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {t("all_types")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConsultationFilter("in_person")}
                    className={cn(
                      "px-2.5 py-1.5 border-l border-gray-200 transition-colors flex items-center gap-1",
                      consultationFilter === "in_person"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <UserRound className="h-3 w-3" />
                    {t("in_person")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConsultationFilter("video")}
                    className={cn(
                      "px-2.5 py-1.5 border-l border-gray-200 transition-colors flex items-center gap-1",
                      consultationFilter === "video"
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Monitor className="h-3 w-3" />
                    {t("video_call")}
                  </button>
                </div>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
              {filteredDoctors.map((doctor) => (
                <CompactDoctorCard
                  key={doctor.id}
                  ref={setCardRef(doctor.id)}
                  doctor={doctor}
                  locale={locale}
                  isHighlighted={hoveredDoctorId === doctor.id}
                  onHover={setHoveredDoctorId}
                  availability={
                    availability ? availability[doctor.id] || null : undefined
                  }
                  liveAvailable={!!liveAvailability[doctor.id]}
                />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Trigger button (exported for use in server page) ── */

interface MapViewButtonProps {
  doctors: Doctor[];
  locale: string;
  availability?: Record<string, DoctorMultiDayAvailability>;
  centerLocation?: { lat: number; lng: number; city: string; countryCode?: string };
  liveAvailability?: Record<string, boolean>;
  /** "default" = expand chip for desktop map; "fab" = floating mobile control */
  variant?: "default" | "fab";
}

export function MapViewButton({
  doctors,
  locale,
  availability,
  centerLocation,
  liveAvailability,
  variant = "default",
}: MapViewButtonProps) {
  const t = useTranslations("search");
  const [open, setOpen] = useState(false);

  // Check if any doctors have coordinates
  const hasMapData = useMemo(() => {
    return doctors.some((d) => {
      const doc: any = d;
      const loc: any = Array.isArray(d.location) ? d.location[0] : d.location;
      return (
        (doc.clinic_latitude != null && doc.clinic_longitude != null) ||
        (loc && loc.latitude != null && loc.longitude != null)
      );
    });
  }, [doctors]);

  if (!hasMapData) return null;

  return (
    <>
      {variant === "fab" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 active:scale-95 transition-all"
          aria-label={t("map_view")}
        >
          <MapPin className="h-5 w-5" />
          {t("map_view")}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-lg border border-gray-200 hover:bg-gray-50 hover:shadow-xl transition-all duration-200"
        >
          <Maximize2 className="h-4 w-4" />
          {t("map_view")}
        </button>
      )}
      <MapViewDialog
        open={open}
        onOpenChange={setOpen}
        doctors={doctors}
        locale={locale}
        availability={availability}
        centerLocation={centerLocation}
        liveAvailability={liveAvailability}
      />
    </>
  );
}
