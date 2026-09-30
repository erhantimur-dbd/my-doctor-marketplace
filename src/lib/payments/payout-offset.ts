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
