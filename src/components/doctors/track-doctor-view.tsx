"use client";

import { useEffect } from "react";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";

interface TrackDoctorViewProps {
  id: string;
  slug: string;
  name: string;
  specialty: string;
  avatarUrl: string | null;
  rating: number;
}

/**
 * Invisible client component that tracks a doctor profile view
 * in localStorage when mounted.
 */
export function TrackDoctorView(props: TrackDoctorViewProps) {
  const { trackView } = useRecentlyViewed();

  useEffect(() => {
    trackView(props);
  }, [props.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
