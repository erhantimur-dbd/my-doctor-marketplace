/**
 * Pending doctor offset applied at transfer time.
 * Destination charges: raise application_fee_amount (capped at the charge).
 * Wallet-credit share: shrink the platform-balance transfer.
 */

export function destinationFeeWithOffset(input: {
  applicationFeeCents: number;
  chargeCents: number;
  offsetCents: number;
}): { applicationFeeCents: number; offsetAppliedCents: number } {
  const fee = Math.max(0, input.applicationFeeCents);
  const charge = Math.max(0, input.chargeCents);
  const room = Math.max(0, charge - fee);
  const applied = Math.min(room, Math.max(0, input.offsetCents));
  return {
    applicationFeeCents: fee + applied,
    offsetAppliedCents: applied,
  };
}

/**
 * Cents of an applied offset to give back when a booking is refunded.
 * Pro rata to this refund against the original paid total, and never more
 * than the hold still outstanding.
 */
export function offsetRestoreCents(input: {
  holdCents: number;
  alreadyRestoredCents: number;
  refundCents: number;
  originalPaidCents: number;
}): number {
  const hold = Math.max(0, Math.round(input.holdCents));
  const already = Math.max(0, Math.round(input.alreadyRestoredCents));
  const refund = Math.max(0, Math.round(input.refundCents));
  const original = Math.max(0, Math.round(input.originalPaidCents));
  if (hold === 0 || refund === 0 || original === 0) return 0;
  const share = Math.round((hold * Math.min(refund, original)) / original);
  const room = Math.max(0, hold - already);
  return Math.min(room, Math.max(0, share));
}

export function transferAmountWithOffset(input: {
  transferCents: number;
  offsetCents: number;
}): { transferCents: number; offsetAppliedCents: number } {
  const transfer = Math.max(0, input.transferCents);
  const applied = Math.min(transfer, Math.max(0, input.offsetCents));
  return {
    transferCents: transfer - applied,
    offsetAppliedCents: applied,
  };
}
