import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  PENDING_TRANSFER_GRACE_MS,
  isStalePendingCreditTransfer,
  reconcilePendingCreditTransfer,
  type ListedPlatformTransfer,
  type PendingTransferAlert,
} from "@/lib/stripe/pending-credit-transfer";
import {
  WALLET_CREDIT_SHARE_KIND,
  walletCreditTransferGroup,
  type WalletCreditTransferRecord,
} from "@/lib/stripe/wallet-credit-share";

const NOW = new Date("2026-09-26T12:30:00.000Z");

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function row(
  overrides: Partial<WalletCreditTransferRecord> = {}
): WalletCreditTransferRecord {
  return {
    id: "row-1",
    booking_id: "book-1",
    doctor_id: "doc-1",
    amount_cents: 8500,
    credit_amount_cents: 10000,
    commission_cents: 1500,
    stripe_transfer_id: null,
    status: "pending",
    statement_line: "Paid with MyDoctors360 credit",
    currency: "gbp",
    reversed_cents: 0,
    kind: WALLET_CREDIT_SHARE_KIND,
    created_at: new Date(NOW.getTime() - PENDING_TRANSFER_GRACE_MS - 60_000).toISOString(),
    ...overrides,
  };
}

function shareTransfer(
  overrides: Partial<ListedPlatformTransfer> = {}
): ListedPlatformTransfer {
  return {
    id: "tr_found",
    amount: 8500,
    destination: "acct_doctor",
    metadata: {
      booking_id: "book-1",
      kind: WALLET_CREDIT_SHARE_KIND,
    },
    ...overrides,
  };
}

function memoryAlert() {
  const claimed = new Set<string>();
  const sent: Array<{
    kind: string;
    bookingId: string;
    doctorId: string;
    amountCents: number;
  }> = [];
  const alert: PendingTransferAlert = {
    async claim(key) {
      if (claimed.has(key)) return false;
      claimed.add(key);
      return true;
    },
    async release(key) {
      claimed.delete(key);
    },
    async send(input) {
      sent.push(input);
    },
  };
  return { alert, sent, claimed };
}

describe("reconcilePendingCreditTransfer", () => {
  it("marks the row paid and stores the Stripe transfer id when the transfer exists", async () => {
    const marks: { bookingId: string; transferId: string }[] = [];
    const lists: { transferGroup: string; destinationAccountId: string | null }[] = [];
    const { alert, sent } = memoryAlert();

    const result = await reconcilePendingCreditTransfer(row(), {
      now: NOW,
      doctorStripeAccountId: async () => "acct_doctor",
      listTransfers: async (input) => {
        lists.push(input);
        return [shareTransfer()];
      },
      markPaidIfPending: async (bookingId, transferId) => {
        marks.push({ bookingId, transferId });
        return true;
      },
      fullCreditWasRestored: async () => false,
      alert,
    });

    expect(result).toEqual({
      action: "marked_paid",
      transferId: "tr_found",
      restoredAlert: "none",
    });
    expect(marks).toEqual([{ bookingId: "book-1", transferId: "tr_found" }]);
    expect(lists).toEqual([
      {
        transferGroup: walletCreditTransferGroup("book-1"),
        destinationAccountId: "acct_doctor",
      },
    ]);
    expect(sent).toEqual([]);
  });

  it("leaves a missing transfer pending and alerts once with booking, doctor, and amount", async () => {
    const marks: string[] = [];
    const { alert, sent } = memoryAlert();
    const deps = {
      now: NOW,
      doctorStripeAccountId: async () => "acct_doctor",
      listTransfers: async () => [],
      markPaidIfPending: async () => {
        marks.push("marked");
        return true;
      },
      fullCreditWasRestored: async () => false,
      alert,
    };

    const first = await reconcilePendingCreditTransfer(row(), deps);
    const second = await reconcilePendingCreditTransfer(row(), deps);

    expect(first).toEqual({ action: "missing", alert: "sent" });
    expect(second).toEqual({ action: "missing", alert: "already_sent" });
    expect(marks).toEqual([]);
    expect(sent).toEqual([
      {
        kind: "missing_transfer",
        bookingId: "book-1",
        doctorId: "doc-1",
        amountCents: 8500,
      },
    ]);
  });

  it("ignores a pending row younger than 15 minutes", async () => {
    const listTransfers = vi.fn();
    const markPaidIfPending = vi.fn();
    const { alert, sent } = memoryAlert();

    const result = await reconcilePendingCreditTransfer(
      row({
        created_at: new Date(NOW.getTime() - PENDING_TRANSFER_GRACE_MS + 1_000).toISOString(),
      }),
      { now: NOW, listTransfers, markPaidIfPending, alert }
    );

    expect(result).toEqual({ action: "ignored" });
    expect(listTransfers).not.toHaveBeenCalled();
    expect(markPaidIfPending).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
    expect(
      isStalePendingCreditTransfer(
        row({
          created_at: new Date(NOW.getTime() - 14 * 60 * 1000).toISOString(),
        }),
        NOW
      )
    ).toBe(false);
  });

  it("never touches a paid row", async () => {
    const listTransfers = vi.fn();
    const markPaidIfPending = vi.fn();
    const { alert, sent } = memoryAlert();

    const result = await reconcilePendingCreditTransfer(
      row({
        status: "paid",
        stripe_transfer_id: "tr_already",
        created_at: new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      }),
      { now: NOW, listTransfers, markPaidIfPending, alert }
    );

    expect(result).toEqual({ action: "ignored" });
    expect(listTransfers).not.toHaveBeenCalled();
    expect(markPaidIfPending).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it("checks a pending row that is exactly 15 minutes old", async () => {
    const result = await reconcilePendingCreditTransfer(
      row({
        created_at: new Date(NOW.getTime() - PENDING_TRANSFER_GRACE_MS).toISOString(),
      }),
      {
        now: NOW,
        doctorStripeAccountId: async () => null,
        listTransfers: async () => [shareTransfer()],
        markPaidIfPending: async () => true,
        fullCreditWasRestored: async () => false,
        alert: memoryAlert().alert,
      }
    );

    expect(result.action).toBe("marked_paid");
  });

  it("does not treat a different transfer on the same booking as the credit share", async () => {
    const markPaidIfPending = vi.fn();
    const { alert, sent } = memoryAlert();

    const result = await reconcilePendingCreditTransfer(row(), {
      now: NOW,
      doctorStripeAccountId: async () => "acct_doctor",
      listTransfers: async () => [
        shareTransfer({
          id: "tr_gp",
          amount: 8500,
          metadata: { booking_id: "book-1", kind: "gp_reassignment" },
        }),
        shareTransfer({ id: "tr_other_amount", amount: 100 }),
      ],
      markPaidIfPending,
      alert,
    });

    expect(result).toEqual({ action: "missing", alert: "sent" });
    expect(markPaidIfPending).not.toHaveBeenCalled();
    expect(sent).toHaveLength(1);
  });

  it("flags a paid transfer when the patient's full credit was already returned, without debiting", async () => {
    const marks: string[] = [];
    const { alert, sent } = memoryAlert();
    const deps = {
      now: NOW,
      doctorStripeAccountId: async () => "acct_doctor",
      listTransfers: async () => [shareTransfer()],
      markPaidIfPending: async (_bookingId: string, transferId: string) => {
        marks.push(transferId);
        return true;
      },
      fullCreditWasRestored: async () => true,
      alert,
    };

    const first = await reconcilePendingCreditTransfer(row(), deps);
    const second = await reconcilePendingCreditTransfer(row(), deps);

    expect(first).toEqual({
      action: "marked_paid",
      transferId: "tr_found",
      restoredAlert: "sent",
    });
    expect(second.action).toBe("marked_paid");
    if (second.action === "marked_paid") {
      expect(second.restoredAlert).toBe("already_sent");
    }
    expect(marks).toEqual(["tr_found", "tr_found"]);
    expect(sent).toEqual([
      {
        kind: "paid_but_credit_restored",
        bookingId: "book-1",
        doctorId: "doc-1",
        amountCents: 8500,
      },
    ]);
    expect(read("src/lib/stripe/pending-credit-transfer.ts")).not.toContain("debitWallet");
  });

  it("does not alert when the Stripe list fails", async () => {
    const { alert, sent } = memoryAlert();
    const markPaidIfPending = vi.fn();

    const result = await reconcilePendingCreditTransfer(row(), {
      now: NOW,
      doctorStripeAccountId: async () => "acct_doctor",
      listTransfers: async () => {
        throw new Error("stripe down");
      },
      markPaidIfPending,
      alert,
    });

    expect(result).toEqual({ action: "stripe_error" });
    expect(markPaidIfPending).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it("releases the once-only claim when sending the alert throws", async () => {
    let fail = true;
    const claimed = new Set<string>();
    const alert: PendingTransferAlert = {
      async claim(key) {
        if (claimed.has(key)) return false;
        claimed.add(key);
        return true;
      },
      async release(key) {
        claimed.delete(key);
      },
      async send() {
        if (fail) throw new Error("mail down");
      },
    };

    await expect(
      reconcilePendingCreditTransfer(row(), {
        now: NOW,
        doctorStripeAccountId: async () => null,
        listTransfers: async () => [],
        alert,
      })
    ).rejects.toThrow("mail down");
    expect(claimed.size).toBe(0);

    fail = false;
    const sent: string[] = [];
    alert.send = async (input) => {
      sent.push(input.kind);
    };
    const retry = await reconcilePendingCreditTransfer(row(), {
      now: NOW,
      doctorStripeAccountId: async () => null,
      listTransfers: async () => [],
      alert,
    });
    expect(retry).toEqual({ action: "missing", alert: "sent" });
    expect(sent).toEqual(["missing_transfer"]);
  });
});

describe("pending credit transfer cron registration", () => {
  it("runs every 15 minutes behind the existing cron secret check", () => {
    const vercel = JSON.parse(read("vercel.json")) as {
      crons: { path: string; schedule: string }[];
    };
    expect(vercel.crons).toContainEqual({
      path: "/api/cron/wallet-credit-transfers",
      schedule: "*/15 * * * *",
    });

    const route = read("src/app/api/cron/wallet-credit-transfers/route.ts");
    expect(route).toContain("authorizeCronRequest");
    expect(route).toContain("reconcileStalePendingCreditTransfers");

    const health = read("src/app/[locale]/(admin)/admin/health/page.tsx");
    expect(health).toContain('path: "/api/cron/wallet-credit-transfers"');
    expect(health).toContain('schedule: "*/15 * * * *"');
  });
});
