/**
 * Booking reference shapes.
 *
 * New rows are `MD-` plus 6 characters from BOOKING_NUMBER_ALPHABET.
 * Older rows stay `BK-YYYYMMDD-XXXX`. Either may carry one or more `-R`
 * reschedule suffixes. The date inside a legacy number is not an
 * appointment date; nothing here parses it.
 */
export const BOOKING_NUMBER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export const BOOKING_NUMBER_EXAMPLE = "MD-7K3Q9X";

const LEGACY_BOOKING_NUMBER = /^BK-\d{8}-[A-Z0-9]{4}$/;
const CURRENT_BOOKING_NUMBER = new RegExp(
  `^MD-[${BOOKING_NUMBER_ALPHABET}]{6}$`
);

function bookingNumberBody(value: string): string {
  let body = value.trim().toUpperCase();
  while (body.endsWith("-R")) {
    body = body.slice(0, -2);
  }
  return body;
}

export function isBookingNumber(value: string): boolean {
  const body = bookingNumberBody(value);
  return (
    LEGACY_BOOKING_NUMBER.test(body) || CURRENT_BOOKING_NUMBER.test(body)
  );
}

/**
 * Canonical form: trim, drop spaces, uppercase, and insert a missing dash.
 * Keeps one or more `-R` suffixes. Validity is `isBookingNumber` only —
 * null when that rejects the result.
 */
export function normalizeBookingNumber(input: string): string | null {
  const trimmed = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!trimmed) return null;
  if (isBookingNumber(trimmed)) return trimmed;

  const rebuilt = insertBookingDashes(trimmed.replace(/-/g, ""));
  if (rebuilt && isBookingNumber(rebuilt)) return rebuilt;
  return null;
}

/** Place the dashes. `isBookingNumber` decides whether the result is real. */
function insertBookingDashes(compact: string): string | null {
  if (compact.startsWith("MD")) {
    const rest = compact.slice(2);
    if (rest.length < 6) return null;
    const suffix = rest.slice(6);
    if (![...suffix].every((ch) => ch === "R")) return null;
    return `MD-${rest.slice(0, 6)}${"-R".repeat(suffix.length)}`;
  }
  if (compact.startsWith("BK")) {
    const rest = compact.slice(2);
    if (rest.length < 12) return null;
    const suffix = rest.slice(12);
    if (![...suffix].every((ch) => ch === "R")) return null;
    return `BK-${rest.slice(0, 8)}-${rest.slice(8, 12)}${"-R".repeat(suffix.length)}`;
  }
  return null;
}

export function rescheduleSuccessorBookingNumber(bookingNumber: string): string {
  return `${bookingNumber}-R`;
}

export function bookingNumberMatchesQuery(
  bookingNumber: string,
  query: string
): boolean {
  return bookingNumber.toLowerCase().includes(query.trim().toLowerCase());
}
