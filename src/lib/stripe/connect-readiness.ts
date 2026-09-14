/** Connected account can receive destination-charge transfers. */
export function connectAccountIsReady(account: {
  details_submitted?: boolean | null;
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
}): boolean {
  return Boolean(account.charges_enabled && account.payouts_enabled);
}
