/**
 * One allowlist for SECURITY DEFINER EXECUTE exceptions.
 * Both structural tests import this module. Do not copy the names into either test.
 *
 * availability: public slot search. Anon and authenticated keep EXECUTE.
 * rlsInvoker: RLS policies call these as the invoker, including anon.
 *   Revoking anon EXECUTE would break those policies.
 * authenticatedOnly: the signed-in user client calls these. Anon is revoked;
 *   authenticated EXECUTE stays.
 */
export const DEFINER_GRANT_ALLOWLIST = {
  availability: [
    "get_available_slots",
    "get_available_dates_in_range",
    "get_doctor_ids_available_today",
    "get_live_available_doctor_ids",
    "get_next_available_slots_batch",
    "get_multi_day_available_slots_batch",
  ],
  rlsInvoker: [
    "rls_is_admin",
    "rls_is_own_doctor",
    "rls_get_doctor_id",
    "rls_is_verified_doctor_profile",
    "rls_is_review_patient",
    "rls_is_booking_patient_of_doctor",
    "get_user_org_ids",
  ],
  authenticatedOnly: ["nextval_invoice_number", "get_org_bookings"],
} as const;

const availability = new Set<string>(DEFINER_GRANT_ALLOWLIST.availability);
const rlsInvoker = new Set<string>(DEFINER_GRANT_ALLOWLIST.rlsInvoker);
const authenticatedOnly = new Set<string>(DEFINER_GRANT_ALLOWLIST.authenticatedOnly);

export function isAvailabilityGrantException(name: string): boolean {
  return availability.has(name) || name.startsWith("get_gp_") || name.endsWith("_batch");
}

/** Skip the 00124+ rule that both anon and authenticated lose EXECUTE. */
export function isDefinerGrantException(name: string): boolean {
  return (
    isAvailabilityGrantException(name) ||
    rlsInvoker.has(name) ||
    authenticatedOnly.has(name)
  );
}

/** Anon EXECUTE may remain. authenticatedOnly names are not included. */
export function mayKeepAnonExecute(name: string): boolean {
  return isAvailabilityGrantException(name) || rlsInvoker.has(name);
}
