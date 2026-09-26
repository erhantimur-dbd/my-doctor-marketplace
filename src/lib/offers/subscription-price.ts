/** Pence on the subscription item. Missing or zero is not a catalogue substitute. */
export function unitAmountPence(unitAmount: number | null | undefined): number | null {
  if (typeof unitAmount !== "number" || !Number.isFinite(unitAmount) || unitAmount <= 0) {
    return null;
  }
  return Math.round(unitAmount);
}
