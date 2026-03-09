"use client";

import React, { Component, type ReactNode } from "react";
import { MapPin } from "lucide-react";

interface MapErrorBoundaryProps {
  children: ReactNode;
  className?: string;
  lat?: number;
  lng?: number;
}

interface MapErrorBoundaryState {
  hasError: boolean;
}

/**
 * Error boundary that catches Google Maps rendering failures
 * (e.g. RefererNotAllowedMapError) and shows a graceful fallback
 * instead of crashing the entire page.
 */
export class MapErrorBoundary extends Component<
  MapErrorBoundaryProps,
  MapErrorBoundaryState
> {
  constructor(props: MapErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): MapErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn("[MapErrorBoundary] Google Maps failed to render:", error.message);
  }

  render() {
    if (this.state.hasError) {
      const { className, lat, lng } = this.props;
      const googleMapsUrl =
        lat != null && lng != null
          ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
          : null;

      return (
        <div
          className={`flex flex-col items-center justify-center gap-2 bg-muted/30 text-muted-foreground ${className || "h-48 w-full"}`}
        >
          <MapPin className="h-6 w-6" />
          <p className="text-xs">Map unavailable</p>
          {googleMapsUrl && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline"
            >
              View on Google Maps
            </a>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
