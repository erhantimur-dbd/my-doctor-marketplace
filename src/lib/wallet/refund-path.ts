import { getCommissionCents } from "@/lib/utils/currency";

export function shouldRefundStripeToCard(
  destination: "bank" | "wallet"
): boolean {
  return destination === "bank";
}

/** Doctor net from a wallet-only payment (platform already holds the funds). */
export function walletPayoutTransferCents(chargedCents: number): number {
  if (chargedCents <= 0) return 0;
  return Math.max(0, chargedCents - getCommissionCents(chargedCents));
}

export function findWalletPayoutTransfer<
  T extends {
    id: string;
    reversed?: boolean | null;
    metadata?: Record<string, string> | null;
  },
>(transfers: T[], bookingId: string): T | undefined {
  return transfers.find(
    (t) =>
      !t.reversed &&
      (t.metadata?.booking_id === bookingId ||
        t.metadata?.type === "wallet_payout") &&
      t.metadata?.booking_id === bookingId
  );
}
