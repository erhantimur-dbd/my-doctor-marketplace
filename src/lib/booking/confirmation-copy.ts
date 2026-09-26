/**
 * Confirmation-page copy after Checkout, wallet pay, or charge-skip.
 *
 * The page used to always render the pre-payment sentence
 * ("will be confirmed once payment is completed") under a confirmed heading.
 * That is a false payment state once Stripe, the booking row, or the
 * return mode already shows payment is done.
 */

export type ConfirmationLookupMode =
  | "stripe_session"
  | "wallet_booking"
  | "direct_confirm"
  | "invalid"
  | string;

export type ConfirmationCopyInput = {
  status?: string | null;
  paidAt?: string | null;
  stripePaymentStatus?: string | null;
  stripeSessionStatus?: string | null;
  lookupMode?: ConfirmationLookupMode | null;
};

export const CONFIRMATION_PAID_HEADING_KEY = "booking_confirmed";
export const CONFIRMATION_PAID_BODY_KEY = "payment_complete_note";
export const CONFIRMATION_PENDING_HEADING_KEY =
  "confirmation_payment_pending_title";
export const CONFIRMATION_PENDING_BODY_KEY = "payment_confirm_note";

const SETTLED_BOOKING_STATUSES = new Set([
  "confirmed",
  "approved",
  "completed",
  "pending_approval",
]);

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Pending-payment wording only when nothing on the booking or the Checkout
 * session says payment already completed.
 */
export function isConfirmationPaymentPending(
  input: ConfirmationCopyInput
): boolean {
  const mode = normalized(input.lookupMode);
  // Wallet debit and charge-skip return these URLs only after the server
  // has already confirmed the booking.
  if (mode === "wallet_booking" || mode === "direct_confirm") return false;

  const stripePay = normalized(input.stripePaymentStatus);
  if (stripePay === "paid" || stripePay === "no_payment_required") return false;

  if (normalized(input.stripeSessionStatus) === "complete") return false;

  if ((input.paidAt ?? "").trim().length > 0) return false;

  if (SETTLED_BOOKING_STATUSES.has(normalized(input.status))) return false;

  return true;
}

export function confirmationCopy(input: ConfirmationCopyInput): {
  paymentPending: boolean;
  headingKey:
    | typeof CONFIRMATION_PAID_HEADING_KEY
    | typeof CONFIRMATION_PENDING_HEADING_KEY;
  bodyKey:
    | typeof CONFIRMATION_PAID_BODY_KEY
    | typeof CONFIRMATION_PENDING_BODY_KEY;
} {
  if (isConfirmationPaymentPending(input)) {
    return {
      paymentPending: true,
      headingKey: CONFIRMATION_PENDING_HEADING_KEY,
      bodyKey: CONFIRMATION_PENDING_BODY_KEY,
    };
  }

  return {
    paymentPending: false,
    headingKey: CONFIRMATION_PAID_HEADING_KEY,
    bodyKey: CONFIRMATION_PAID_BODY_KEY,
  };
}
