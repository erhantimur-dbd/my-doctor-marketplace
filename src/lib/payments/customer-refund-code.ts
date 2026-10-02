/**
 * Customer-facing refund reference.
 *
 * Format: RF- plus the booking ref without the MD- prefix.
 * MD-TT9EJN → RF-TT9EJN. A later refund on the same booking is RF-TT9EJN-2.
 * The full Stripe refund id is stored beside the code and is not shown in mail.
 */

export interface StoredCustomerRefund {
  code: string;
  stripe_refund_id: string | null;
  amount_cents: number;
  recorded_at: string;
}

export function customerRefundCodeForBooking(
  bookingNumber: string,
  part = 1
): string {
  const trimmed = bookingNumber.trim().toUpperCase();
  const body = trimmed.replace(/^MD-/, "") || trimmed || "BOOKING";
  const safe = body.replace(/[^A-Z0-9-]/g, "") || "BOOKING";
  const base = `RF-${safe}`;
  const n = Number.isFinite(part) ? Math.max(1, Math.floor(part)) : 1;
  return n === 1 ? base : `${base}-${n}`;
}

export function parseCustomerRefundCodes(value: unknown): StoredCustomerRefund[] {
  if (!Array.isArray(value)) return [];
  const rows: StoredCustomerRefund[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const code = typeof row.code === "string" ? row.code.trim() : "";
    if (!code) continue;
    const stripe =
      typeof row.stripe_refund_id === "string" && row.stripe_refund_id.trim()
        ? row.stripe_refund_id.trim()
        : null;
    rows.push({
      code,
      stripe_refund_id: stripe,
      amount_cents: Math.max(0, Math.round(Number(row.amount_cents) || 0)),
      recorded_at:
        typeof row.recorded_at === "string" && row.recorded_at
          ? row.recorded_at
          : "",
    });
  }
  return rows;
}

/** Code to show when the ledger says this refund was already recorded. */
export function customerRefundCodeOnReplay(input: {
  bookingNumber?: string | null;
  existing: unknown;
  stripeRefundId?: string | null;
}): string | null {
  const found = lookupCustomerRefundCode(input.existing, input.stripeRefundId);
  if (found) return found;
  const rows = parseCustomerRefundCodes(input.existing);
  if (rows.length > 0) return rows[rows.length - 1].code;
  const bookingNumber = input.bookingNumber?.trim() || "";
  if (!bookingNumber) return null;
  return customerRefundCodeForBooking(bookingNumber, 1);
}

export function lookupCustomerRefundCode(
  existing: unknown,
  stripeRefundId: string | null | undefined
): string | null {
  const stripe = stripeRefundId?.trim() || "";
  if (!stripe) return null;
  const found = parseCustomerRefundCodes(existing).find(
    (row) => row.stripe_refund_id === stripe
  );
  return found?.code ?? null;
}

/**
 * Stable code for this Stripe refund. A repeat of the same Stripe id reuses
 * the stored code. A new refund on the booking gets the next part suffix.
 * Returns null when there is no booking number to hang the code on.
 */
export function assignCustomerRefundCode(input: {
  bookingNumber: string;
  existing: unknown;
  stripeRefundId: string | null | undefined;
  amountCents: number;
  now?: string;
}): { code: string; codes: StoredCustomerRefund[] } | null {
  const bookingNumber = input.bookingNumber.trim();
  if (!bookingNumber) return null;

  const existing = parseCustomerRefundCodes(input.existing);
  const stripe = input.stripeRefundId?.trim() || null;
  if (stripe) {
    const found = existing.find((row) => row.stripe_refund_id === stripe);
    if (found) return { code: found.code, codes: existing };
  }

  const code = customerRefundCodeForBooking(bookingNumber, existing.length + 1);
  const codes: StoredCustomerRefund[] = [
    ...existing,
    {
      code,
      stripe_refund_id: stripe,
      amount_cents: Math.max(0, Math.round(input.amountCents)),
      recorded_at: input.now || new Date().toISOString(),
    },
  ];
  return { code, codes };
}

/** Last-line guard so a Stripe id cannot be printed if a caller still passes one. */
export function displayRefundReference(
  refundRef: string,
  bookingRef: string
): string {
  const value = refundRef.trim();
  if (/^re_[A-Za-z0-9]+$/.test(value) || /^refund-/i.test(value)) {
    return customerRefundCodeForBooking(bookingRef, 1);
  }
  return value;
}
