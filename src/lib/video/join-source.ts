export const CONSULT_JOIN_SOURCES = [
  "email_join_page",
  "booking_confirmation",
  "patient_dashboard",
  "doctor_dashboard",
  "guest_join",
] as const;

export type ConsultJoinSource = (typeof CONSULT_JOIN_SOURCES)[number];

export function isConsultJoinSource(value: string): value is ConsultJoinSource {
  return (CONSULT_JOIN_SOURCES as readonly string[]).includes(value);
}

/** Sources a forwarded booking email or guest link may authorise. */
export function sourceAllowsGuestSignature(source: ConsultJoinSource): boolean {
  return (
    source === "email_join_page" ||
    source === "booking_confirmation" ||
    source === "guest_join"
  );
}
