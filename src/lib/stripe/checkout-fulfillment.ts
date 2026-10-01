/**
 * When a Checkout Session may change bookings, wallets, gift cards, or
 * founding seats. Delayed payment methods emit checkout.session.completed
 * while payment_status is still unpaid. Fulfilling that event credits
 * stored value before the money arrives. The later
 * checkout.session.async_payment_succeeded event is the paid signal.
 */

export type CheckoutFulfillmentSession = {
  mode?: string | null;
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
};

export function checkoutSessionShouldFulfill(
  session: CheckoutFulfillmentSession
): boolean {
  if (session.payment_status === "paid") return true;
  // A 100% coupon subscription has nothing left to collect. An unpaid
  // subscription must not claim a founding seat.
  if (
    session.mode === "subscription" &&
    session.payment_status === "no_payment_required"
  ) {
    return true;
  }
  return false;
}

/**
 * Credit only the amount Stripe charged. Metadata amount_cents is set by
 * our server at session create and must not be used when amount_total is
 * missing or zero.
 */
export function walletTopUpCredit(
  session: CheckoutFulfillmentSession
): { amountCents: number; currency: string } | null {
  if (typeof session.amount_total !== "number") return null;
  if (!Number.isInteger(session.amount_total) || session.amount_total <= 0) {
    return null;
  }
  const currency = (session.currency || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return null;
  return { amountCents: session.amount_total, currency };
}

export function giftCardPaymentMatches(
  card: { amount_cents: number; currency: string },
  session: CheckoutFulfillmentSession
): boolean {
  if (typeof session.amount_total !== "number") return false;
  if (!Number.isInteger(card.amount_cents) || card.amount_cents <= 0) {
    return false;
  }
  if (session.amount_total !== card.amount_cents) return false;
  const paidCurrency = (session.currency || "").trim().toUpperCase();
  const cardCurrency = card.currency.trim().toUpperCase();
  return paidCurrency.length === 3 && paidCurrency === cardCurrency;
}
