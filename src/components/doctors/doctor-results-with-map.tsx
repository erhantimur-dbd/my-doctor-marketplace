"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { DoctorCard } from "./doctor-card";
import type { MapDoctor } from "@/components/maps/doctor-map";

// Dynamic import — Leaflet requires window
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
}

export function DoctorResultsWithMap({
  doctors,
  locale,
}: DoctorResultsWithMapProps) {
  const [hoveredDoctorId, setHoveredDoctorId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Build map-friendly data from doctors that have location with lat/lng
  const mapDoctors: MapDoctor[] = useMemo(() => {
    return doctors
      .filter(
        (d) =>
          d.location &&
          (d.location as Record<string, unknown>).latitude != null &&
          (d.location as Record<string, unknown>).longitude != null
      )
      .map((d) => {
        const loc = d.location as Record<string, unknown>;
        const primarySpec =
          d.specialties?.find((s) => s.is_primary)?.specialty ||
          d.specialties?.[0]?.specialty;
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
          lat: Number(loc.latitude),
          lng: Number(loc.longitude),
        };
      });
  }, [doctors]);

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
            />
          </div>
        </div>
      )}
    </div>
  );
}
