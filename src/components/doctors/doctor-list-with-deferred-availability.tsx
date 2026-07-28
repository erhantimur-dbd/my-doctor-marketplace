"use client";

/**
 * Renders doctor cards immediately, then loads multi-day availability + live
 * status in the browser so the symptom-search critical path is not blocked by
 * batch slot RPCs on the server.
 *
 * Until enrichment finishes, pass `availability={undefined}` so DoctorCard
 * hides the slot strip (undefined !== null). After load, pass real data;
 * DoctorCard syncs via useEffect on the availability prop.
 */
import { useEffect, useState } from "react";
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
  // undefined = not loaded yet (hide strip); Record = enrichment complete
  const [availability, setAvailability] = useState<
    Record<string, DoctorMultiDayAvailability> | undefined
  >(undefined);
  const [liveAvailability, setLiveAvailability] = useState<
    Record<string, boolean>
  >({});
  const [enrichmentReady, setEnrichmentReady] = useState(false);

  useEffect(() => {
    const ids = doctors.map((d) => d.id);
    if (ids.length === 0) {
      setAvailability({});
      setEnrichmentReady(true);
      return;
    }

    let cancelled = false;
    setEnrichmentReady(false);
    setAvailability(undefined);
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
          // Failed enrich: empty map so cards can show waitlist, not stuck loading
          setAvailability({});
        }
      } finally {
        if (!cancelled) setEnrichmentReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [doctors, consultationType]);

  if (withMap) {
    return (
      <div className="relative">
        {!enrichmentReady && doctors.length > 0 && (
          <p className="mb-2 text-xs text-muted-foreground" aria-live="polite">
            Loading available times…
          </p>
        )}
        <DoctorResultsWithMap
          doctors={doctors}
          locale={locale}
          // undefined until ready → cards omit slot column; then real map
          availability={availability}
          centerLocation={centerLocation}
          matchScores={matchScores}
          distances={distances}
          liveAvailability={liveAvailability}
          topEndorsements={topEndorsements}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!enrichmentReady && doctors.length > 0 && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Loading available times…
        </p>
      )}
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
