"use client";

import { useEffect, useState } from "react";
import { getLiveDoctorAvailability } from "@/actions/live-availability";
import { DoctorCard } from "@/components/doctors/doctor-card";
import type { DoctorMultiDayAvailability } from "@/actions/search";

interface DoctorGridLiveProps {
  doctors: Parameters<typeof DoctorCard>[0]["doctor"][];
  locale: string;
  availability: Record<string, DoctorMultiDayAvailability | null>;
  initialLive?: Record<string, boolean>;
}

export function DoctorGridLive({
  doctors,
  locale,
  availability,
  initialLive = {},
}: DoctorGridLiveProps) {
  const [liveMap, setLiveMap] = useState<Record<string, boolean>>(initialLive);

  const doctorIds = doctors.map((d) => d.id);

  useEffect(() => {
    if (doctorIds.length === 0) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const fresh = await getLiveDoctorAvailability(doctorIds);
        if (!cancelled) setLiveMap(fresh);
      } catch {
        // silent
      }
    };
    poll();
    const interval = setInterval(poll, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorIds.join(",")]);

  const hasAnyLive = Object.values(liveMap).some(Boolean);

  return (
    <>
      {hasAnyLive && (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
          Appointment available within the next hour
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {doctors.map((doctor) => (
          <div key={doctor.id} className="min-w-0">
            <DoctorCard
              doctor={doctor}
              locale={locale}
              availability={availability[doctor.id] || null}
              compact
              liveAvailable={!!liveMap[doctor.id]}
            />
          </div>
        ))}
      </div>
    </>
  );
}
