/**
 * Resolve how the booking-confirmation page should load a booking.
 * Pure helper — used by the page and unit tests.
 *
 * Stripe Checkout returns ?session_id=cs_…
 * Wallet-only pay returns ?booking_id=…&wallet=true (no Stripe session).
 */

export type ConfirmationQuery = {
  session_id?: string | null;
  booking_id?: string | null;
  wallet?: string | null;
};

export type ConfirmationLookup =
  | { mode: "stripe_session"; sessionId: string }
  | { mode: "wallet_booking"; bookingId: string }
  | { mode: "invalid" };

function nonEmpty(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Prefer Stripe session when both params present (payment just completed).
 * Wallet path requires booking_id; wallet=true is preferred but booking_id alone
 * is accepted when session_id is absent (matches createBookingAndCheckout return).
 */
export function resolveConfirmationLookup(
  query: ConfirmationQuery
): ConfirmationLookup {
  const sessionId = nonEmpty(query.session_id ?? undefined);
  if (sessionId) {
    return { mode: "stripe_session", sessionId };
  }

  const bookingId = nonEmpty(query.booking_id ?? undefined);
  if (!bookingId) {
    return { mode: "invalid" };
  }

  const wallet = (query.wallet ?? "").toLowerCase();
  if (wallet === "true" || wallet === "1" || wallet === "") {
    // Empty wallet still allowed if only booking_id was passed (wallet-only URL shape)
    return { mode: "wallet_booking", bookingId };
  }

  // booking_id with an explicit non-wallet flag is still treated as wallet path
  // when no session_id — call site enforces auth ownership.
  return { mode: "wallet_booking", bookingId };
}

/** True when confirmation can proceed without a Stripe session id. */
export function isWalletOnlyConfirmation(query: ConfirmationQuery): boolean {
  return resolveConfirmationLookup(query).mode === "wallet_booking";
}
