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
 * Trim, drop spaces, uppercase, and insert a missing dash.
 * Returns the canonical `BK-` / `MD-` form including any `-R` suffixes,
 * or null when the value is not a booking number.
 */
export function normalizeBookingNumber(value: string): string | null {
  const trimmed = value.trim().toUpperCase().replace(/\s+/g, "");
  if (!trimmed) return null;
  if (isBookingNumber(trimmed)) return trimmed;

  const compact = trimmed.replace(/-/g, "");
  const rebuilt = rebuildMd(compact) ?? rebuildBk(compact);
  if (rebuilt && isBookingNumber(rebuilt)) return rebuilt;
  return null;
}

function rebuildMd(compact: string): string | null {
  if (!compact.startsWith("MD")) return null;
  const rest = compact.slice(2);
  if (rest.length < 6) return null;
  const body = rest.slice(0, 6);
  const suffix = rest.slice(6);
  if (![...body].every((ch) => BOOKING_NUMBER_ALPHABET.includes(ch))) {
    return null;
  }
  if (![...suffix].every((ch) => ch === "R")) return null;
  return `MD-${body}${"-R".repeat(suffix.length)}`;
}

function rebuildBk(compact: string): string | null {
  if (!compact.startsWith("BK")) return null;
  const rest = compact.slice(2);
  if (rest.length < 12) return null;
  const date = rest.slice(0, 8);
  const code = rest.slice(8, 12);
  const suffix = rest.slice(12);
  if (!/^\d{8}$/.test(date) || !/^[A-Z0-9]{4}$/.test(code)) return null;
  if (![...suffix].every((ch) => ch === "R")) return null;
  return `BK-${date}-${code}${"-R".repeat(suffix.length)}`;
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
