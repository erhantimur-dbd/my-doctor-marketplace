"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { CompactDoctorCard } from "./compact-doctor-card";
import { DoctorCard } from "./doctor-card";
import type { MapDoctor } from "@/components/maps/doctor-map";
import type { DoctorMultiDayAvailability } from "@/actions/search";

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
}

function MapViewDialog({
  open,
  onOpenChange,
  doctors,
  locale,
  availability,
  centerLocation,
}: MapViewDialogProps) {
  const t = useTranslations("search");
  const [hoveredDoctorId, setHoveredDoctorId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Build map-friendly data from doctors with coordinates
  const mapDoctors: MapDoctor[] = useMemo(() => {
    return doctors
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
            ? primarySpec.name_key
                .replace("specialty.", "")
                .replace(/_/g, " ")
                .replace(/\b\w/g, (l: string) => l.toUpperCase())
            : "",
          lat,
          lng,
          isLocal,
        };
      });
  }, [doctors, centerLocation]);

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
      <DialogContent className="max-w-[96vw] sm:max-w-[96vw] w-[96vw] h-[90vh] p-0 gap-0 overflow-hidden">
        {/* Visually hidden title for a11y */}
        <DialogTitle className="sr-only">
          {t("map_view")}
        </DialogTitle>

        <div className="flex h-full min-h-0 overflow-hidden">
          {/* Left panel: scrollable card list */}
          <div className="w-[32%] min-h-0 border-r overflow-y-auto">
            <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
              <p className="text-sm font-medium text-muted-foreground">
                {t("doctors_on_map", { count: mapDoctors.length })}
              </p>
            </div>
            <div className="p-3 space-y-3">
              {doctors.map((doctor) => (
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
                />
              ))}
            </div>
          </div>

          {/* Right panel: large map */}
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <DoctorMap
              doctors={mapDoctors}
              hoveredDoctorId={hoveredDoctorId}
              onHoverDoctor={setHoveredDoctorId}
              onClickDoctor={handleClickDoctor}
              centerLocation={centerLocation}
            />
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
}

export function MapViewButton({
  doctors,
  locale,
  availability,
  centerLocation,
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
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <MapPin className="h-4 w-4" />
        {t("map_view")}
      </Button>
      <MapViewDialog
        open={open}
        onOpenChange={setOpen}
        doctors={doctors}
        locale={locale}
        availability={availability}
        centerLocation={centerLocation}
      />
    </>
  );
}
