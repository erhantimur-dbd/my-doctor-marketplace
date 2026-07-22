"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import {
  buildProfileFitBlurb,
  type ProfileFitDoctor,
} from "@/lib/search/profile-fit";
import { useSearchIntentStore } from "@/stores/search-intent-store";

interface ProfileFitBannerProps {
  doctor: ProfileFitDoctor;
  specialtyDisplay?: string | null;
}

/**
 * Client banner: why this doctor fits the patient's current search intent.
 * Hydrates intent from session store and document.referrer / session if needed.
 */
export function ProfileFitBanner({
  doctor,
  specialtyDisplay,
}: ProfileFitBannerProps) {
  const filters = useSearchIntentStore((s) => s.filters);
  const hydrateFromPath = useSearchIntentStore((s) => s.hydrateFromPath);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Prefer store; if empty, try session last search path
    try {
      const last = sessionStorage.getItem("md360_last_search_path");
      if (last && last.includes("/doctors")) {
        hydrateFromPath(last);
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, [hydrateFromPath]);

  const fit = useMemo(
    () => buildProfileFitBlurb(filters, doctor, { specialtyDisplay }),
    [filters, doctor, specialtyDisplay]
  );

  if (!ready || !fit.hasIntent || !fit.blurb) return null;

  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3 text-sm text-foreground">
      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div>
        <p className="font-medium text-primary">Why this doctor</p>
        <p className="mt-0.5 text-muted-foreground leading-snug">{fit.blurb}</p>
      </div>
    </div>
  );
}
