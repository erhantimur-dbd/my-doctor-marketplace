/**
 * Pure helpers for doctor available-slot fetching (booking wizard).
 * Kept free of I/O so golden tests can drive real behavior without mocking Supabase.
 */

export type SlotRow = {
  slot_start: string;
  slot_end: string;
  is_available?: boolean;
};

/**
 * Normalize consultation type for get_available_slots RPC.
 * Empty / unknown → in_person (RPC rejects empty string schedules).
 */
export function normalizeConsultationType(
  consultationType: string | null | undefined
): "in_person" | "video" {
  return consultationType === "video" ? "video" : "in_person";
}

/**
 * Map RPC result to UI contract.
 * - RPC error → error string, empty slots
 * - Success with 0 rows → no error (empty day)
 * - Success with rows → filter bookable slots (is_available !== false)
 */
export function mapGetAvailableSlotsResult(input: {
  data: SlotRow[] | null | undefined;
  error: { message?: string } | null | undefined;
}): { slots: SlotRow[]; error?: string } {
  if (input.error) {
    return { slots: [], error: "Failed to fetch available slots." };
  }
  const rows = input.data || [];
  const slots = rows.filter((s) => s.is_available !== false);
  return { slots };
}

/**
 * Args for the unique 5-parameter get_available_slots overload.
 * Shorter overloads are ambiguous in Postgres (42725 function is not unique).
 */
export function buildGetAvailableSlotsRpcArgs(input: {
  doctorId: string;
  date: string;
  consultationType: string;
  slotDurationOverride?: number | null;
  clinicLocationId?: string | null;
}): {
  p_doctor_id: string;
  p_date: string;
  p_consultation_type: "in_person" | "video";
  p_slot_duration_override: number | null;
  p_clinic_location_id: string | null;
} {
  return {
    p_doctor_id: input.doctorId,
    p_date: input.date,
    p_consultation_type: normalizeConsultationType(input.consultationType),
    p_slot_duration_override:
      input.slotDurationOverride != null && input.slotDurationOverride > 0
        ? input.slotDurationOverride
        : null,
    p_clinic_location_id: input.clinicLocationId ?? null,
  };
}

/** Detect ambiguous-function RPC failures (wrong overload selection). */
export function isAmbiguousFunctionError(errorMessage: string): boolean {
  return /not unique|42725|Could not choose a best candidate/i.test(
    errorMessage
  );
}
