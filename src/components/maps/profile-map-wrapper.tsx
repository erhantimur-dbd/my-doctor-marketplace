"use client";

import dynamic from "next/dynamic";

const ProfileMap = dynamic(
  () => import("@/components/maps/profile-map").then((mod) => mod.ProfileMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-48 items-center justify-center bg-muted/30 animate-pulse">
        <span className="text-sm text-muted-foreground">Loading map...</span>
      </div>
    ),
  }
);

interface ProfileMapWrapperProps {
  lat: number;
  lng: number;
  label?: string;
}

export function ProfileMapWrapper({ lat, lng, label }: ProfileMapWrapperProps) {
  return <ProfileMap lat={lat} lng={lng} label={label} />;
}
