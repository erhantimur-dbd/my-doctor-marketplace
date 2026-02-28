"use client";

import { useEffect, useMemo, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  InfoWindow,
  useMap,
} from "@vis.gl/react-google-maps";
import type { Pharmacy } from "@/types/pharmacy";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

interface PharmacyMapProps {
  pharmacies: Pharmacy[];
  hoveredPharmacyId: string | null;
  onHoverPharmacy: (id: string | null) => void;
}

/* ── Auto-fit bounds when results change ── */
function FitBounds({ pharmacies }: { pharmacies: Pharmacy[] }) {
  const map = useMap();

  useEffect(() => {
    if (!map || pharmacies.length === 0) return;

    const withCoords = pharmacies.filter((p) => p.lat && p.lng);
    if (withCoords.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    withCoords.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });

    // Clamp zoom for tight clusters
    const listener = google.maps.event.addListenerOnce(map, "idle", () => {
      const zoom = map.getZoom();
      if (zoom != null && zoom > 16) map.setZoom(16);
    });
    return () => google.maps.event.removeListener(listener);
  }, [pharmacies, map]);

  return null;
}

/* ── Green pharmacy pin marker ── */
function PharmacyPin({
  pharmacy,
  isHovered,
  onHover,
}: {
  pharmacy: Pharmacy;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}) {
  const size = isHovered ? 36 : 28;
  const height = Math.round(size * 1.4);
  const fill = isHovered ? "#f97316" : "#16a34a";
  const stroke = isHovered ? "#ea580c" : "#15803d";

  return (
    <AdvancedMarker
      position={{ lat: pharmacy.lat, lng: pharmacy.lng }}
      zIndex={isHovered ? 1000 : 1}
    >
      <div
        onMouseEnter={() => onHover(pharmacy.id)}
        onMouseLeave={() => onHover(null)}
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
          {/* Pharmacy cross icon */}
          <rect x="10.5" y="7" width="3" height="10" rx="0.5" fill="#fff" />
          <rect x="7" y="10.5" width="10" height="3" rx="0.5" fill="#fff" />
        </svg>
      </div>
    </AdvancedMarker>
  );
}

/* ── Main map component ── */
export function PharmacyMap({
  pharmacies,
  hoveredPharmacyId,
  onHoverPharmacy,
}: PharmacyMapProps) {
  const [infoPharmacy, setInfoPharmacy] = useState<Pharmacy | null>(null);

  const center = useMemo(() => {
    const withCoords = pharmacies.filter((p) => p.lat && p.lng);
    if (withCoords.length === 0) return { lat: 51.5074, lng: -0.1278 }; // London
    const avgLat =
      withCoords.reduce((s, p) => s + p.lat, 0) / withCoords.length;
    const avgLng =
      withCoords.reduce((s, p) => s + p.lng, 0) / withCoords.length;
    return { lat: avgLat, lng: avgLng };
  }, [pharmacies]);

  // Show info window on hover
  useEffect(() => {
    if (hoveredPharmacyId) {
      const p = pharmacies.find((ph) => ph.id === hoveredPharmacyId);
      if (p) setInfoPharmacy(p);
    } else {
      setInfoPharmacy(null);
    }
  }, [hoveredPharmacyId, pharmacies]);

  const validPharmacies = pharmacies.filter((p) => p.lat && p.lng);

  if (validPharmacies.length === 0) {
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
        defaultZoom={13}
        mapId="pharmacy-search-map"
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapTypeControl={false}
        streetViewControl={false}
        fullscreenControl={false}
        className="h-full w-full"
        style={{ minHeight: "400px" }}
      >
        <FitBounds pharmacies={validPharmacies} />

        {validPharmacies.map((pharmacy) => (
          <PharmacyPin
            key={pharmacy.id}
            pharmacy={pharmacy}
            isHovered={hoveredPharmacyId === pharmacy.id}
            onHover={onHoverPharmacy}
          />
        ))}

        {infoPharmacy && (
          <InfoWindow
            position={{ lat: infoPharmacy.lat, lng: infoPharmacy.lng }}
            pixelOffset={[0, -45]}
            onCloseClick={() => setInfoPharmacy(null)}
            headerDisabled
          >
            <div className="text-sm" style={{ minWidth: 150 }}>
              <p className="font-semibold">{infoPharmacy.name}</p>
              <p className="text-xs text-gray-500">{infoPharmacy.postcode}</p>
              {infoPharmacy.phone && (
                <p className="text-xs text-gray-500">{infoPharmacy.phone}</p>
              )}
            </div>
          </InfoWindow>
        )}
      </Map>
    </APIProvider>
  );
}
