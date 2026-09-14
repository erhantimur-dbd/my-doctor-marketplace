import { describe, expect, it } from "vitest";
import { getCommissionCents } from "@/lib/utils/currency";
import {
  findWalletPayoutTransfer,
  shouldRefundStripeToCard,
  walletPayoutTransferCents,
} from "@/lib/wallet/refund-path";

describe("shouldRefundStripeToCard", () => {
  it("refunds the card for bank destination, not for wallet", () => {
    expect(shouldRefundStripeToCard("bank")).toBe(true);
    expect(shouldRefundStripeToCard("wallet")).toBe(false);
  });
});

describe("walletPayoutTransferCents", () => {
  it("sends doctor net (charge minus 15%) to the connected account", () => {
    expect(walletPayoutTransferCents(10000)).toBe(10000 - getCommissionCents(10000));
    expect(walletPayoutTransferCents(0)).toBe(0);
    expect(walletPayoutTransferCents(-1)).toBe(0);
  });
});

describe("findWalletPayoutTransfer", () => {
  it("matches unreverted payout for the booking", () => {
    const hit = findWalletPayoutTransfer(
      [
        {
          id: "tr_old",
          reversed: true,
          metadata: { booking_id: "b1", type: "wallet_payout" },
        },
        {
          id: "tr_ok",
          reversed: false,
          metadata: { booking_id: "b1", type: "wallet_payout" },
        },
      ],
      "b1"
    );
    expect(hit?.id).toBe("tr_ok");
  });
});
