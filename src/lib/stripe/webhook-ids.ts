export function bookingIdFromCheckoutMetadata(
  metadata: Record<string, string | undefined> | null | undefined
): string | undefined {
  const bookingId = metadata?.booking_id?.trim();
  if (bookingId) return bookingId;
  const first = metadata?.first_booking_id?.trim();
  return first || undefined;
}

/** Connect `account.application.deauthorized` — connected account is event.account. */
export function deauthorizedConnectedAccountId(event: {
  account?: string | null;
  data?: { object?: { id?: string | null } | null } | null;
}): string | undefined {
  const account = event.account?.trim();
  if (account?.startsWith("acct_")) return account;
  return undefined;
}
