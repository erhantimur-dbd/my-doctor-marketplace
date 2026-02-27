"use client";

import { useEffect, useMemo, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from "@vis.gl/react-google-maps";

export interface MapDoctor {
  id: string;
  slug: string;
  name: string;
  specialty: string;
  lat: number;
  lng: number;
  /** Whether the doctor is in the same country as the selected location filter */
  isLocal: boolean;
}

interface DoctorMapProps {
  doctors: MapDoctor[];
  hoveredDoctorId: string | null;
  onHoverDoctor: (id: string | null) => void;
  onClickDoctor: (id: string) => void;
  /** When a location filter is active, center the map on this city */
  centerLocation?: { lat: number; lng: number; city: string; countryCode?: string };
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

/* ── Auto-fit bounds when doctors change ── */
function FitBounds({
  doctors,
  centerLocation,
}: {
  doctors: MapDoctor[];
  centerLocation?: { lat: number; lng: number; city: string };
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // When a location filter is active, fit bounds to LOCAL doctors only so
    // the map opens centered on the relevant area. Distant pins are still
    // rendered but only visible when the user zooms out.
    const localDoctors = doctors.filter((d) => d.isLocal);
    const docsForBounds = localDoctors.length > 0 ? localDoctors : doctors;

    if (docsForBounds.length === 0 && centerLocation) {
      // No doctors but we have a city — zoom to city level
      map.setCenter({ lat: centerLocation.lat, lng: centerLocation.lng });
      map.setZoom(12);
      return;
    }

    if (docsForBounds.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    docsForBounds.forEach((d) => bounds.extend({ lat: d.lat, lng: d.lng }));

    // If a center location is set, include it in bounds to keep the city in view
    if (centerLocation) {
      bounds.extend({ lat: centerLocation.lat, lng: centerLocation.lng });
    }

    map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });

    // When a city is selected, clamp zoom to city-level (~3 mile radius)
    // to keep surrounding context visible even if doctors are clustered tightly
    if (centerLocation) {
      const listener = google.maps.event.addListenerOnce(map, "idle", () => {
        const currentZoom = map.getZoom();
        if (currentZoom != null && currentZoom > 14) {
          map.setZoom(14);
        }
      });
      return () => google.maps.event.removeListener(listener);
    }
  }, [doctors, map, centerLocation]);

  return null;
}

/* ── Custom SVG pin marker ── */
function PinMarker({
  doctor,
  isHovered,
  onHover,
  onClick,
}: {
  doctor: MapDoctor;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
}) {
  const isLocal = doctor.isLocal;

  // Distant doctors: smaller, muted gray pin; local: standard blue; hovered: orange
  const size = isHovered ? 36 : isLocal ? 28 : 20;
  const height = Math.round(size * 1.4);
  const fill = isHovered ? "#f97316" : isLocal ? "#4285F4" : "#9ca3af";
  const stroke = isHovered ? "#ea580c" : isLocal ? "#2563eb" : "#6b7280";

  // z-index: hovered > local > distant
  const zIndex = isHovered ? 1000 : isLocal ? 1 : 0;

  return (
    <AdvancedMarker
      position={{ lat: doctor.lat, lng: doctor.lng }}
      zIndex={zIndex}
    >
      <div
        onMouseEnter={() => onHover(doctor.id)}
        onMouseLeave={() => onHover(null)}
        onClick={() => onClick(doctor.id)}
        style={{ cursor: "pointer", transform: "translate(-50%, -100%)" }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={size}
          height={height}
          viewBox="0 0 24 34"
          style={{
            filter: isHovered
              ? "drop-shadow(0 2px 6px rgba(0,0,0,0.4))"
              : isLocal
                ? "drop-shadow(0 1px 3px rgba(0,0,0,0.3))"
                : "drop-shadow(0 1px 2px rgba(0,0,0,0.15))",
            transition: "all 0.15s ease",
            opacity: isHovered ? 1 : isLocal ? 1 : 0.7,
          }}
        >
          <path
            d="M12 0C5.4 0 0 5.4 0 12c0 9 12 22 12 22s12-13 12-22C24 5.4 18.6 0 12 0z"
            fill={fill}
            stroke={stroke}
            strokeWidth="0.5"
          />
          <circle cx="12" cy="12" r="5" fill="#fff" />
        </svg>
      </div>
    </AdvancedMarker>
  );
}

/* ── Main map component ── */
export function DoctorMap({
  doctors,
  hoveredDoctorId,
  onHoverDoctor,
  onClickDoctor,
  centerLocation,
}: DoctorMapProps) {
  const [infoDoctor, setInfoDoctor] = useState<MapDoctor | null>(null);

  const center = useMemo(() => {
    // Prefer explicit center when a location filter is active
    if (centerLocation) return { lat: centerLocation.lat, lng: centerLocation.lng };
    if (doctors.length === 0) return { lat: 48.8566, lng: 2.3522 };
    const avgLat =
      doctors.reduce((sum, d) => sum + d.lat, 0) / doctors.length;
    const avgLng =
      doctors.reduce((sum, d) => sum + d.lng, 0) / doctors.length;
    return { lat: avgLat, lng: avgLng };
  }, [doctors, centerLocation]);

  // Show info window on hover
  useEffect(() => {
    if (hoveredDoctorId) {
      const doc = doctors.find((d) => d.id === hoveredDoctorId);
      if (doc) setInfoDoctor(doc);
    } else {
      setInfoDoctor(null);
    }
  }, [hoveredDoctorId, doctors]);

  if (doctors.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/30 text-sm text-muted-foreground">
        No locations to display
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        defaultCenter={center}
        defaultZoom={centerLocation ? 12 : 10}
        mapId="doctor-search-map"
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        className="h-full w-full"
        style={{ minHeight: "400px" }}
      >
        <FitBounds doctors={doctors} centerLocation={centerLocation} />

        {doctors.map((doctor) => (
          <PinMarker
            key={doctor.id}
            doctor={doctor}
            isHovered={hoveredDoctorId === doctor.id}
            onHover={onHoverDoctor}
            onClick={onClickDoctor}
          />
        ))}

        {infoDoctor && (
          <InfoWindow
            position={{ lat: infoDoctor.lat, lng: infoDoctor.lng }}
            pixelOffset={[0, -45]}
            onCloseClick={() => setInfoDoctor(null)}
            headerDisabled
          >
            <div className="text-sm" style={{ minWidth: 120 }}>
              <p className="font-semibold">{infoDoctor.name}</p>
              {infoDoctor.specialty && (
                <p className="text-xs text-gray-500">{infoDoctor.specialty}</p>
              )}
            </div>
          </InfoWindow>
        )}
      </Map>
    </APIProvider>
  );
}
