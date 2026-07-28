"use client";

import type { ProfileFitDoctor } from "@/lib/search/profile-fit";

interface ProfileFitBannerProps {
  doctor: ProfileFitDoctor;
  specialtyDisplay?: string | null;
}

/** Temporarily disabled — faded tile overlapped the profile hero. */
export function ProfileFitBanner(_props: ProfileFitBannerProps) {
  return null;
}
