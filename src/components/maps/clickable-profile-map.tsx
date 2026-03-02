"use client";

import { useState, useCallback } from "react";
import { ProfileMapWrapper } from "@/components/maps/profile-map-wrapper";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Expand, ExternalLink } from "lucide-react";

interface ClickableProfileMapProps {
  lat: number;
  lng: number;
  label?: string;
  className?: string;
  containerClassName?: string;
}

export function ClickableProfileMap({
  lat,
  lng,
  label,
  className,
  containerClassName,
}: ClickableProfileMapProps) {
  const [showExpanded, setShowExpanded] = useState(false);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  const handleClick = useCallback(() => {
    // Check if mobile (< 768px)
    const isMobile = window.matchMedia("(max-width: 767px)").matches;

    if (isMobile) {
      // Open Google Maps on mobile
      window.open(googleMapsUrl, "_blank");
    } else {
      // Open expanded view on desktop
      setShowExpanded(true);
    }
  }, [googleMapsUrl]);

  return (
    <>
      <div
        className={`group/map relative cursor-pointer ${containerClassName || ""}`}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <ProfileMapWrapper
          lat={lat}
          lng={lng}
          label={label}
          className={className}
        />
        {/* Click overlay with hover effect */}
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/0 transition-colors group-hover/map:bg-black/10">
          <div className="rounded-full bg-white/90 p-2.5 opacity-0 shadow-lg transition-opacity group-hover/map:opacity-100">
            <Expand className="h-4 w-4 text-gray-700" />
          </div>
        </div>
      </div>

      {/* Expanded map dialog (desktop) */}
      <Dialog open={showExpanded} onOpenChange={setShowExpanded}>
        <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0">
          <DialogHeader className="px-5 pt-4 pb-2">
            <DialogTitle className="text-base">{label || "Location"}</DialogTitle>
          </DialogHeader>
          <div className="h-[500px] w-full">
            <ProfileMapWrapper
              lat={lat}
              lng={lng}
              label={label}
              className="h-full w-full"
              interactive
            />
          </div>
          <div className="flex justify-end px-5 py-3">
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open in Google Maps
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
