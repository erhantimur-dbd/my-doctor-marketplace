"use client";

/**
 * Renders doctor cards immediately, then loads multi-day availability + live
 * status in the browser so the symptom-search critical path is not blocked by
 * batch slot RPCs on the server.
 *
 * While enriching, pass availabilityLoading so cards reserve the slot column
 * with a skeleton (no compact→expand jump on refresh).
 */
import { useEffect, useMemo, useState } from "react";
import { DoctorCard } from "@/components/doctors/doctor-card";
import { DoctorResultsWithMap } from "@/components/doctors/doctor-results-with-map";
import {
  getMultiDayAvailabilityBatch,
  type DoctorMultiDayAvailability,
} from "@/actions/search";
import { getLiveDoctorAvailability } from "@/actions/live-availability";

type Doctor = Parameters<typeof DoctorCard>[0]["doctor"];

interface Props {
  doctors: Doctor[];
  locale: string;
  consultationType?: string;
  centerLocation?: {
    lat: number;
    lng: number;
    city: string;
    countryCode?: string;
  };
  matchScores?: Record<string, { score: number; reasons: string[] }>;
  distances?: Record<string, number>;
  topEndorsements?: Record<string, { label: string; count: number }[]>;
  withMap?: boolean;
}

export function DoctorListWithDeferredAvailability({
  doctors,
  locale,
  consultationType,
  centerLocation,
  matchScores,
  distances,
  topEndorsements = {},
  withMap = true,
}: Props) {
  const [availability, setAvailability] = useState<
    Record<string, DoctorMultiDayAvailability> | undefined
  >(undefined);
  const [liveAvailability, setLiveAvailability] = useState<
    Record<string, boolean>
  >({});
  const [enrichmentReady, setEnrichmentReady] = useState(false);

  // Stable key so parent re-renders with a new array identity do not re-fetch
  // and collapse the slot panel mid-session.
  const doctorIdsKey = useMemo(
    () => doctors.map((d) => d.id).join(","),
    [doctors]
  );

  useEffect(() => {
    const ids = doctorIdsKey ? doctorIdsKey.split(",").filter(Boolean) : [];
    if (ids.length === 0) {
      setAvailability({});
      setEnrichmentReady(true);
      return;
    }

    let cancelled = false;
    setEnrichmentReady(false);
    // Keep previous availability visible while re-fetching (no collapse flash).
    // Only undefined on first mount of this key.
    (async () => {
      try {
        const [avail, live] = await Promise.all([
          getMultiDayAvailabilityBatch(ids, consultationType),
          getLiveDoctorAvailability(ids),
        ]);
        if (!cancelled) {
          setAvailability(avail ?? {});
          setLiveAvailability(live ?? {});
        }
      } catch {
        if (!cancelled) {
          setAvailability({});
        }
      } finally {
        if (!cancelled) setEnrichmentReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [doctorIdsKey, consultationType]);

  const loading = !enrichmentReady;

  if (withMap) {
    return (
      <DoctorResultsWithMap
        doctors={doctors}
        locale={locale}
        availability={availability}
        availabilityLoading={loading}
        centerLocation={centerLocation}
        matchScores={matchScores}
        distances={distances}
        liveAvailability={liveAvailability}
        topEndorsements={topEndorsements}
      />
    );
  }

  return (
    <div className="space-y-5">
      {doctors.map((doctor) => (
        <div key={doctor.id}>
          <DoctorCard
            doctor={doctor}
            locale={locale}
            availability={
              availability === undefined
                ? undefined
                : availability[doctor.id] || null
            }
            availabilityLoading={loading}
            matchScore={matchScores?.[doctor.id]?.score}
            matchReasons={matchScores?.[doctor.id]?.reasons}
            distanceKm={distances?.[doctor.id]}
            liveAvailable={!!liveAvailability[doctor.id]}
          />
        </div>
      ))}
    </div>
  );
}
