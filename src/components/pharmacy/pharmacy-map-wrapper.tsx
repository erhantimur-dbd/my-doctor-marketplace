"use client";

import dynamic from "next/dynamic";
import type { Pharmacy } from "@/types/pharmacy";

const PharmacyMap = dynamic(
  () =>
    import("@/components/pharmacy/pharmacy-map").then(
      (mod) => mod.PharmacyMap
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-muted/30 animate-pulse">
        <span className="text-sm text-muted-foreground">Loading map...</span>
      </div>
    ),
  }
);

interface PharmacyMapWrapperProps {
  pharmacies: Pharmacy[];
  hoveredPharmacyId: string | null;
  onHoverPharmacy: (id: string | null) => void;
}

export function PharmacyMapWrapper(props: PharmacyMapWrapperProps) {
  return <PharmacyMap {...props} />;
}
