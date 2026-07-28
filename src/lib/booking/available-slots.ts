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
 * Whether the PostgREST error indicates a missing 4-arg overload
 * (p_slot_duration_override not deployed).
 */
export function shouldRetryWithoutDurationOverride(errorMessage: string): boolean {
  return /p_slot_duration_override|Could not find the function|function public\.get_available_slots|does not exist/i.test(
    errorMessage
  );
}
