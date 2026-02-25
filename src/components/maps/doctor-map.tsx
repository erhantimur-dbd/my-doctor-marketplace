"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

// Custom SVG marker icons
function createMarkerIcon(color: string, size: number) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size * 1.4}" viewBox="0 0 24 34">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 22 12 22s12-13 12-22C24 5.4 18.6 0 12 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/>
    <circle cx="12" cy="12" r="5" fill="#fff"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: "custom-marker",
    iconSize: [size, size * 1.4],
    iconAnchor: [size / 2, size * 1.4],
    popupAnchor: [0, -(size * 1.4)],
  });
}

const defaultIcon = createMarkerIcon("#3b82f6", 28);
const highlightIcon = createMarkerIcon("#f97316", 36);

// Component to auto-fit map bounds when doctors change
function FitBounds({ doctors }: { doctors: MapDoctor[] }) {
  const map = useMap();

  useEffect(() => {
    if (doctors.length === 0) return;

    const bounds = L.latLngBounds(
      doctors.map((d) => [d.lat, d.lng] as [number, number])
    );

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [doctors, map]);

  return null;
}

export function DoctorMap({
  doctors,
  hoveredDoctorId,
  onHoverDoctor,
  onClickDoctor,
}: DoctorMapProps) {
  const markerRefs = useRef<Map<string, L.Marker>>(new Map());

  // Default center (Europe) in case no doctors
  const center = useMemo<[number, number]>(() => {
    if (doctors.length === 0) return [48.8566, 2.3522];
    const avgLat = doctors.reduce((sum, d) => sum + d.lat, 0) / doctors.length;
    const avgLng = doctors.reduce((sum, d) => sum + d.lng, 0) / doctors.length;
    return [avgLat, avgLng];
  }, [doctors]);

  // Open popup on highlighted marker
  useEffect(() => {
    if (hoveredDoctorId) {
      const marker = markerRefs.current.get(hoveredDoctorId);
      if (marker) marker.openPopup();
    } else {
      markerRefs.current.forEach((marker) => marker.closePopup());
    }
  }, [hoveredDoctorId]);

  if (doctors.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/30 text-sm text-muted-foreground">
        No locations to display
      </div>
    );
  }

  return (
    <MapContainer
      center={center}
      zoom={10}
      scrollWheelZoom={true}
      className="h-full w-full"
      style={{ minHeight: "400px" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds doctors={doctors} />
      {doctors.map((doctor) => (
        <Marker
          key={doctor.id}
          position={[doctor.lat, doctor.lng]}
          icon={
            hoveredDoctorId === doctor.id ? highlightIcon : defaultIcon
          }
          ref={(ref) => {
            if (ref) {
              markerRefs.current.set(doctor.id, ref);
            }
          }}
          eventHandlers={{
            mouseover: () => onHoverDoctor(doctor.id),
            mouseout: () => onHoverDoctor(null),
            click: () => onClickDoctor(doctor.id),
          }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{doctor.name}</p>
              {doctor.specialty && (
                <p className="text-muted-foreground">{doctor.specialty}</p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
