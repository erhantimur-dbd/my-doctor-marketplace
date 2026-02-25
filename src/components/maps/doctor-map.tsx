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
}

interface DoctorMapProps {
  doctors: MapDoctor[];
  hoveredDoctorId: string | null;
  onHoverDoctor: (id: string | null) => void;
  onClickDoctor: (id: string) => void;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

/* ── Auto-fit bounds when doctors change ── */
function FitBounds({ doctors }: { doctors: MapDoctor[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || doctors.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    doctors.forEach((d) => bounds.extend({ lat: d.lat, lng: d.lng }));
    map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
  }, [doctors, map]);

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
  const size = isHovered ? 36 : 28;
  const height = Math.round(size * 1.4);
  const fill = isHovered ? "#f97316" : "#4285F4";
  const stroke = isHovered ? "#ea580c" : "#2563eb";

  return (
    <AdvancedMarker
      position={{ lat: doctor.lat, lng: doctor.lng }}
      zIndex={isHovered ? 1000 : 0}
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
              : "drop-shadow(0 1px 3px rgba(0,0,0,0.3))",
            transition: "all 0.15s ease",
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
}: DoctorMapProps) {
  const [infoDoctor, setInfoDoctor] = useState<MapDoctor | null>(null);

  const center = useMemo(() => {
    if (doctors.length === 0) return { lat: 48.8566, lng: 2.3522 };
    const avgLat =
      doctors.reduce((sum, d) => sum + d.lat, 0) / doctors.length;
    const avgLng =
      doctors.reduce((sum, d) => sum + d.lng, 0) / doctors.length;
    return { lat: avgLat, lng: avgLng };
  }, [doctors]);

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
        defaultZoom={10}
        mapId="doctor-search-map"
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        className="h-full w-full"
        style={{ minHeight: "400px" }}
      >
        <FitBounds doctors={doctors} />

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
