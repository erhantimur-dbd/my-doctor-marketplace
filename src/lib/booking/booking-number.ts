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

export function rescheduleSuccessorBookingNumber(bookingNumber: string): string {
  return `${bookingNumber}-R`;
}

export function bookingNumberMatchesQuery(
  bookingNumber: string,
  query: string
): boolean {
  return bookingNumber.toLowerCase().includes(query.trim().toLowerCase());
}
