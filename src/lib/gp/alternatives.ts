/**
 * Build 2–3 alternate GP slots when same-time reassignment is impossible.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { GP_SPECIALTY_SLUG } from "./eligibility";
import { log } from "@/lib/utils/logger";
import { randomBytes } from "crypto";

export interface GpSlotOfferDraft {
  doctorId: string;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  consultationType: string;
  feeCents: number;
  doctorName: string;
  token: string;
  expiresAt: string;
}

function makeToken(): string {
  return randomBytes(24).toString("hex");
}

/**
 * Find next available GP slots (not necessarily same time) within the next 48h.
 */
export async function findAlternateGpSlots(params: {
  excludeDoctorId: string;
  consultationType: string;
  maxFeeCents: number;
  limit?: number;
}): Promise<GpSlotOfferDraft[]> {
  const supabase = createAdminClient();
  const limit = params.limit ?? 3;
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2h

  const { data: doctors, error } = await supabase
    .from("doctors")
    .select(
      `
      id,
      consultation_fee_cents,
      consultation_types,
      profile:profiles!doctors_profile_id_fkey(first_name, last_name),
      doctor_specialties!inner(
        is_primary,
        specialty:specialties!inner(slug)
      )
    `
    )
    .eq("is_active", true)
    .eq("verification_status", "verified")
    .not("stripe_account_id", "is", null)
    .lte("consultation_fee_cents", params.maxFeeCents)
    .neq("id", params.excludeDoctorId)
    .eq("doctor_specialties.is_primary", true)
    .eq("doctor_specialties.specialty.slug", GP_SPECIALTY_SLUG)
    .limit(30);

  if (error || !doctors?.length) {
    log.error("[GP] findAlternateGpSlots failed", { err: error });
    return [];
  }

  const offers: GpSlotOfferDraft[] = [];
  const today = new Date();

  for (let dayOffset = 0; dayOffset < 3 && offers.length < limit; dayOffset++) {
    const day = new Date(today);
    day.setDate(day.getDate() + dayOffset);
    const dateStr = day.toISOString().slice(0, 10);

    for (const doc of doctors) {
      if (offers.length >= limit) break;
      const types = (doc.consultation_types || []) as string[];
      if (!types.includes(params.consultationType)) continue;

      const { buildGetAvailableSlotsRpcArgs } = await import(
        "@/lib/booking/available-slots"
      );
      const { data: slots, error: slotErr } = await supabase.rpc(
        "get_available_slots",
        buildGetAvailableSlotsRpcArgs({
          doctorId: doc.id,
          date: dateStr,
          consultationType: params.consultationType,
        })
      );

      if (slotErr || !slots?.length) continue;

      const available = (slots as {
        slot_start?: string;
        slot_end?: string;
        is_available?: boolean;
      }[]).filter((s) => s.is_available !== false && s.slot_start);

      if (!available.length) continue;

      // Prefer first future slot
      const nowMs = Date.now() + 15 * 60 * 1000;
      const first = available.find((s) => {
        const ms = Date.parse(s.slot_start!);
        return Number.isFinite(ms) && ms > nowMs;
      });
      if (!first?.slot_start) continue;

      const startDt = new Date(first.slot_start);
      const endDt = first.slot_end ? new Date(first.slot_end) : new Date(startDt.getTime() + 30 * 60 * 1000);
      const startTime = startDt.toTimeString().slice(0, 8);
      const endTime = endDt.toTimeString().slice(0, 8);

      const profileRaw = doc.profile as
        | { first_name: string | null; last_name: string | null }
        | { first_name: string | null; last_name: string | null }[]
        | null;
      const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
      const doctorName = profile
        ? `Dr. ${profile.first_name || ""} ${profile.last_name || ""}`.trim()
        : "GP";

      offers.push({
        doctorId: doc.id,
        appointmentDate: dateStr,
        startTime: startTime.length === 5 ? `${startTime}:00` : startTime,
        endTime: endTime
          ? endTime.length === 5
            ? `${endTime}:00`
            : endTime
          : startTime,
        consultationType: params.consultationType,
        feeCents: doc.consultation_fee_cents,
        doctorName,
        token: makeToken(),
        expiresAt,
      });
    }
  }

  return offers.slice(0, limit);
}
