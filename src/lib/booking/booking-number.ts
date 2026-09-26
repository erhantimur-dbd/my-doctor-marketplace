/**
 * Booking reference shapes.
 *
 * New rows are `MD-` plus 6 characters from BOOKING_NUMBER_ALPHABET.
 * Older rows stay `BK-YYYYMMDD-XXXX`. Either may carry one reschedule
 * suffix: `-R`, then `-R2`, `-R3`, and so on. The date inside a legacy
 * number is not an appointment date; nothing here parses it.
 */
export const BOOKING_NUMBER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export const BOOKING_NUMBER_EXAMPLE = "MD-7K3Q9X";

/** Bytes at or above this value are rejected so `byte % 31` is unbiased. */
export const BOOKING_NUMBER_BYTE_LIMIT = BOOKING_NUMBER_ALPHABET.length * 8;

const MAX_RESCHEDULE_SUFFIX = 20;
const ALLOCATE_ATTEMPTS = 10;

const LEGACY_BODY = /^BK\d{8}[A-Z0-9]{4}$/;
const CURRENT_BODY = new RegExp(`^MD[${BOOKING_NUMBER_ALPHABET}]{6}$`);
const RESCHEDULE_SUFFIX = /-R(\d+)?$/;

function asSet(values: ReadonlySet<string> | readonly string[]): Set<string> {
  return values instanceof Set ? values : new Set(values);
}

/**
 * Canonical uppercase booking number.
 *
 * Trims, uppercases, and tolerates a missing dash in the body. Keeps a
 * single `-R` or `-Rn` (n >= 2) suffix. Returns null when the value is
 * not a legacy or current booking number.
 */
export function normalizeBookingNumber(input: string): string | null {
  const compactInput = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!compactInput) return null;

  let suffix = "";
  let body = compactInput;
  const suffixMatch = RESCHEDULE_SUFFIX.exec(body);
  if (suffixMatch) {
    const digits = suffixMatch[1];
    if (digits !== undefined) {
      if (!/^[1-9]\d?$/.test(digits) || Number(digits) < 2) return null;
      suffix = `-R${digits}`;
    } else {
      suffix = "-R";
    }
    body = body.slice(0, suffixMatch.index);
  }

  const compact = body.replace(/-/g, "");
  if (CURRENT_BODY.test(compact)) {
    return `MD-${compact.slice(2)}${suffix}`;
  }
  if (LEGACY_BODY.test(compact)) {
    return `BK-${compact.slice(2, 10)}-${compact.slice(10)}${suffix}`;
  }
  return null;
}

export function isBookingNumber(value: string): boolean {
  return normalizeBookingNumber(value) !== null;
}

/** Booking number with any `-R` / `-Rn` suffix removed. */
export function bookingNumberRoot(bookingNumber: string): string | null {
  const canonical = normalizeBookingNumber(bookingNumber);
  if (!canonical) return null;
  return canonical.replace(RESCHEDULE_SUFFIX, "");
}

/**
 * Next explicit reschedule number: `-R`, then `-R2`, `-R3`, ...
 *
 * `taken` is every successor already stored for this root (and the
 * current number itself counts as taken). A second reschedule does not
 * reuse `-R` and does not append another `-R` onto an existing suffix.
 */
export function rescheduleSuccessorBookingNumber(
  bookingNumber: string,
  taken: readonly string[] = []
): string {
  const root = bookingNumberRoot(bookingNumber);
  if (!root) {
    throw new Error("rescheduleSuccessorBookingNumber: invalid booking number");
  }

  const used = new Set<string>();
  const current = normalizeBookingNumber(bookingNumber);
  if (current) used.add(current);
  for (const value of taken) {
    const normalized = normalizeBookingNumber(value);
    used.add(normalized ?? value.trim().toUpperCase());
  }

  for (let n = 1; n <= MAX_RESCHEDULE_SUFFIX; n += 1) {
    const candidate = n === 1 ? `${root}-R` : `${root}-R${n}`;
    if (!used.has(candidate)) return candidate;
  }

  throw new Error("rescheduleSuccessorBookingNumber: no free -R suffix");
}

export function bookingNumberMatchesQuery(
  bookingNumber: string,
  query: string
): boolean {
  return bookingNumber.toLowerCase().includes(query.trim().toLowerCase());
}

/**
 * Admin booking-list search. An empty or whitespace-only query matches
 * every row so the list is not filtered. The needle is trimmed once and
 * applied to the booking number and both names.
 */
export function bookingListMatchesQuery(
  bookingNumber: string,
  patientName: string,
  doctorName: string,
  query: string
): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    bookingNumber.toLowerCase().includes(needle) ||
    patientName.toLowerCase().includes(needle) ||
    doctorName.toLowerCase().includes(needle)
  );
}

/**
 * Map random bytes onto the booking alphabet.
 * Returns null when fewer than 6 unbiased bytes are available.
 */
export function bookingCodeFromBytes(bytes: Uint8Array): string | null {
  let code = "";
  for (const byte of bytes) {
    if (byte >= BOOKING_NUMBER_BYTE_LIMIT) continue;
    code += BOOKING_NUMBER_ALPHABET[byte % BOOKING_NUMBER_ALPHABET.length];
    if (code.length === 6) return code;
  }
  return null;
}

export type AllocateBookingNumberResult =
  | { ok: true; bookingNumber: string }
  | { ok: false; error: string };

/**
 * Same candidate decision as generate_booking_number: draw, treat a row
 * that already exists or a candidate locked by another transaction as a
 * collision, and try again. After `maxAttempts` collisions, fail instead
 * of returning a number that would violate bookings_booking_number_key.
 *
 * `lockedByOther` is the stand-in for pg_advisory_xact_lock. A candidate
 * another insert already claimed must be regenerated even when it is not
 * yet visible in `existing`.
 */
export function allocateBookingNumber(options: {
  existing: ReadonlySet<string> | readonly string[];
  lockedByOther?: ReadonlySet<string> | readonly string[];
  draw: () => string;
  maxAttempts?: number;
}): AllocateBookingNumberResult {
  const maxAttempts = options.maxAttempts ?? ALLOCATE_ATTEMPTS;
  const existing = asSet(options.existing);
  const lockedByOther = asSet(options.lockedByOther ?? []);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const candidate = options.draw();
    if (existing.has(candidate) || lockedByOther.has(candidate)) continue;
    return { ok: true, bookingNumber: candidate };
  }

  return {
    ok: false,
    error: `could not allocate a unique booking number after ${maxAttempts} attempts`,
  };
}
