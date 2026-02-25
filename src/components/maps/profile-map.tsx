"use client";

import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";

interface ProfileMapProps {
  lat: number;
  lng: number;
  label?: string;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export function ProfileMap({ lat, lng }: ProfileMapProps) {
  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        defaultCenter={{ lat, lng }}
        defaultZoom={14}
        mapId="doctor-profile-map"
        gestureHandling="none"
        disableDefaultUI
        clickableIcons={false}
        className="h-48 w-full"
        style={{ minHeight: "192px" }}
      >
        <AdvancedMarker position={{ lat, lng }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="40"
            viewBox="0 0 24 34"
            style={{
              filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.3))",
              transform: "translate(-50%, -100%)",
            }}
          >
            <path
              d="M12 0C5.4 0 0 5.4 0 12c0 9 12 22 12 22s12-13 12-22C24 5.4 18.6 0 12 0z"
              fill="#4285F4"
              stroke="#2563eb"
              strokeWidth="0.5"
            />
            <circle cx="12" cy="12" r="5" fill="#fff" />
          </svg>
        </AdvancedMarker>
      </Map>
    </APIProvider>
  );
}
