"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { DoctorCard } from "./doctor-card";
import type { MapDoctor } from "@/components/maps/doctor-map";
import type { DoctorNextAvailability } from "@/actions/search";

// Dynamic import — Google Maps requires window
const DoctorMap = dynamic(
  () => import("@/components/maps/doctor-map").then((mod) => mod.DoctorMap),
  { ssr: false, loading: () => <MapSkeleton /> }
);

function MapSkeleton() {
  return (
    <div className="flex h-full items-center justify-center bg-muted/30 rounded-lg animate-pulse">
      <span className="text-sm text-muted-foreground">Loading map...</span>
    </div>
  );
}

type Doctor = Parameters<typeof DoctorCard>[0]["doctor"];

interface DoctorResultsWithMapProps {
  doctors: Doctor[];
  locale: string;
  availability?: Record<string, DoctorNextAvailability>;
  centerLocation?: { lat: number; lng: number; city: string; countryCode?: string };
}

export function DoctorResultsWithMap({
  doctors,
  locale,
  availability,
  centerLocation,
}: DoctorResultsWithMapProps) {
  const [hoveredDoctorId, setHoveredDoctorId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Build map-friendly data from doctors that have location with lat/lng.
  // Uses Array.isArray guard because Supabase nested joins may return arrays.
  // Prefers clinic-level coordinates (clinic_latitude/longitude) over city-level
  // for precise map pin placement; falls back to location table centroids.
  // All doctors with valid coords are included; `isLocal` flag controls visual
  // priority (local = same country as selected location, or all if no filter).
  const mapDoctors: MapDoctor[] = useMemo(() => {
    return doctors
      .filter((d) => {
        const doc: any = d;
        const loc: any = Array.isArray(d.location) ? d.location[0] : d.location;
        // Has either clinic-level or city-level coordinates
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
          : true; // No location filter → all are "local"
        // Prefer clinic-level coordinates; fall back to city centroid
        const lat = doc.clinic_latitude != null
          ? Number(doc.clinic_latitude)
          : Number(loc.latitude);
        const lng = doc.clinic_longitude != null
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
      // Brief highlight
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

  const hasMapData = mapDoctors.length > 0;

  return (
    <div className="flex gap-6">
      {/* Doctor list — left side */}
      <div
        className={
          hasMapData
            ? "w-1/2 space-y-4 overflow-y-auto"
            : "w-full grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
        }
      >
        {doctors.map((doctor) => (
          <DoctorCard
            key={doctor.id}
            ref={setCardRef(doctor.id)}
            doctor={doctor}
            locale={locale}
            isHighlighted={hoveredDoctorId === doctor.id}
            onHover={setHoveredDoctorId}
            availability={availability ? (availability[doctor.id] || null) : undefined}
          />
        ))}
      </div>

      {/* Map — right side (only if we have location data) */}
      {hasMapData && (
        <div className="hidden w-1/2 lg:block">
          <div className="sticky top-24 h-[calc(100vh-8rem)] overflow-hidden rounded-lg border">
            <DoctorMap
              doctors={mapDoctors}
              hoveredDoctorId={hoveredDoctorId}
              onHoverDoctor={setHoveredDoctorId}
              onClickDoctor={handleClickDoctor}
              centerLocation={centerLocation}
            />
          </div>
        </div>
      )}
    </div>
  );
}
