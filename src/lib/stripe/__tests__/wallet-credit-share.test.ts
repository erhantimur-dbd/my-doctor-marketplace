import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DOCTOR_CARD_PAYMENTS_UNAVAILABLE_MESSAGE } from "@/lib/stripe/consult-merchant";
import {
  PAID_WITH_WALLET_CREDIT_LINE,
  WALLET_CREDIT_SHARE_KIND,
  WalletCreditTableMissingError,
  consultCheckoutMoney,
  payDoctorWalletCreditShare,
  proportionalCreditTransferReversalCents,
  refundConsultCardAndCreditShare,
  runFullCreditSettlement,
  settlePartCreditAfterCardPayment,
  walletCreditShareIdempotencyKey,
  walletCreditTableMissingCode,
  walletCreditTransferGroup,
  type WalletCreditTransferRecord,
  type WalletCreditTransferStore,
} from "@/lib/stripe/wallet-credit-share";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function memoryStore(): WalletCreditTransferStore {
  const rows = new Map<string, WalletCreditTransferRecord>();
  return {
    async findByBookingId(bookingId) {
      return rows.get(bookingId) ?? null;
    },
    async insert(row) {
      const existing = rows.get(row.booking_id);
      if (existing) return existing;
      const saved: WalletCreditTransferRecord = {
        ...row,
        id: `id-${row.booking_id}`,
        created_at: "2026-09-26T12:00:00.000Z",
      };
      rows.set(row.booking_id, saved);
      return saved;
    },
    async update(bookingId, patch) {
      const current = rows.get(bookingId);
      if (!current) throw new Error("missing transfer row");
      rows.set(bookingId, { ...current, ...patch });
    },
  };
}

function stripeDouble() {
  const creates: { params: Record<string, unknown>; options?: unknown }[] = [];
  const reversals: { id: string; params?: unknown; options?: unknown }[] = [];
  const refunds: Record<string, unknown>[] = [];
  const stripe = {
    refunds: {
      async create(params: {
        payment_intent: string;
        amount: number;
        reverse_transfer: boolean;
        refund_application_fee: boolean;
      }) {
        refunds.push(params);
        return { id: "re_test" };
      },
    },
    transfers: {
      async create(
        params: {
          amount: number;
          currency: string;
          destination: string;
          metadata?: Record<string, string>;
          transfer_group?: string;
        },
        options?: { idempotencyKey?: string }
      ) {
        creates.push({ params, options });
        return { id: `tr_${creates.length}` };
      },
      async createReversal(
        id: string,
        params?: { amount?: number; metadata?: Record<string, string> },
        options?: { idempotencyKey?: string }
      ) {
        reversals.push({ id, params, options });
        return { id: `trr_${reversals.length}` };
      },
    },
  };
  return { stripe, creates, reversals, refunds };
}

function accounts(
  caps:
    | { card_payments?: string | null; transfers?: string | null }
    | "throw"
) {
  return {
    accounts: {
      async retrieve() {
        if (caps === "throw") throw new Error("stripe down");
        return { capabilities: caps };
      },
      async update() {
        return { capabilities: caps === "throw" ? {} : caps };
      },
    },
  };
}

const BOOKING_ID = "book-100";
const DOCTOR_ID = "doc-100";

describe("consult checkout money when the patient uses credit", () => {
  it("keeps a card-only charge on the existing commission rule", () => {
    const money = consultCheckoutMoney({
      consultationFeeCents: 10000,
      stripeChargeCents: 10000,
      walletCreditCents: 0,
    });
    expect(money.applicationFeeCents).toBe(1500);
    expect(money.commissionCents).toBe(1500);
    expect(money.doctorCreditShareCents).toBe(0);
  });

  it("keeps deposit application fee as 15% of the full fee capped at the deposit", () => {
    const money = consultCheckoutMoney({
      consultationFeeCents: 10000,
      stripeChargeCents: 3000,
      walletCreditCents: 0,
    });
    expect(money.applicationFeeCents).toBe(1500);
    expect(money.commissionCents).toBe(1500);
  });

  it("charges 15% of the card only and records commission on card plus credit", () => {
    const money = consultCheckoutMoney({
      consultationFeeCents: 10000,
      stripeChargeCents: 10000,
      walletCreditCents: 4000,
    });
    expect(money.cardCents).toBe(6000);
    expect(money.creditCents).toBe(4000);
    expect(money.applicationFeeCents).toBe(900);
    expect(money.creditCommissionCents).toBe(600);
    expect(money.doctorCreditShareCents).toBe(3400);
    expect(money.commissionCents).toBe(1500);
  });

  it("full credit has no card fee and commission is 15% of the credit", () => {
    const money = consultCheckoutMoney({
      consultationFeeCents: 10000,
      stripeChargeCents: 10000,
      walletCreditCents: 10000,
    });
    expect(money.applicationFeeCents).toBe(0);
    expect(money.doctorCreditShareCents).toBe(8500);
    expect(money.commissionCents).toBe(1500);
  });
});

describe("full-credit booking pays the doctor once", () => {
  const credit = {
    bookingId: BOOKING_ID,
    bookingNumber: "MD-100",
    doctorId: DOCTOR_ID,
    currency: "GBP",
    creditAmountCents: 10000,
    commissionCents: 1500,
    amountCents: 8500,
  };

  it("transfers 85% with an idempotency key and stores commission", async () => {
    const store = memoryStore();
    const { stripe, creates } = stripeDouble();
    const events: string[] = [];
    const originalCreate = stripe.transfers.create.bind(stripe.transfers);
    stripe.transfers.create = async (params, options) => {
      const row = await store.findByBookingId(BOOKING_ID);
      expect(row?.status).toBe("pending");
      expect(row?.stripe_transfer_id).toBeNull();
      events.push("transfer");
      return originalCreate(params, options);
    };
    let debited = false;
    const result = await runFullCreditSettlement(
      {
        stripeAccountId: "acct_doc",
        accounts: accounts({ card_payments: "active", transfers: "active" }),
        credit,
        debit: async () => {
          debited = true;
          events.push("debit");
        },
        restoreWallet: async () => {
          events.push("restore");
        },
      },
      { stripe, store }
    );

    expect(result).toEqual({
      ok: true,
      transferId: "tr_1",
      alreadyPaid: false,
    });
    expect(debited).toBe(true);
    expect(events).toEqual(["debit", "transfer"]);
    expect(creates).toHaveLength(1);
    expect(creates[0]?.params).toMatchObject({
      amount: 8500,
      currency: "gbp",
      destination: "acct_doc",
      transfer_group: walletCreditTransferGroup(BOOKING_ID),
      metadata: {
        booking_id: BOOKING_ID,
        booking_number: "MD-100",
        credit_amount_cents: "10000",
        commission_cents: "1500",
        kind: WALLET_CREDIT_SHARE_KIND,
      },
    });
    expect(creates[0]?.options).toEqual({
      idempotencyKey: walletCreditShareIdempotencyKey(BOOKING_ID),
    });

    const row = await store.findByBookingId(BOOKING_ID);
    expect(row).toMatchObject({
      booking_id: BOOKING_ID,
      doctor_id: DOCTOR_ID,
      amount_cents: 8500,
      credit_amount_cents: 10000,
      commission_cents: 1500,
      stripe_transfer_id: "tr_1",
      status: "paid",
      statement_line: PAID_WITH_WALLET_CREDIT_LINE,
    });
    expect(row?.created_at).toBeTruthy();
  });

  it("does not create a second transfer when confirm runs again", async () => {
    const store = memoryStore();
    const { stripe, creates } = stripeDouble();
    const deps = { stripe, store };
    await payDoctorWalletCreditShare(
      { ...credit, stripeAccountId: "acct_doc" },
      deps
    );
    const again = await payDoctorWalletCreditShare(
      { ...credit, stripeAccountId: "acct_doc" },
      deps
    );
    expect(again).toEqual({
      ok: true,
      transferId: "tr_1",
      alreadyPaid: true,
    });
    expect(creates).toHaveLength(1);
  });
});

describe("a transfer is never sent without a ledger row", () => {
  const credit = {
    bookingId: BOOKING_ID,
    bookingNumber: "MD-100",
    doctorId: DOCTOR_ID,
    stripeAccountId: "acct_doc",
    currency: "GBP",
    creditAmountCents: 10000,
    commissionCents: 1500,
    amountCents: 8500,
  };

  function settlementCredit() {
    const { stripeAccountId: _account, ...rest } = credit;
    return rest;
  }

  it("recognises a missing transfer table", () => {
    expect(walletCreditTableMissingCode({ code: "42P01" })).toBe("42P01");
    expect(walletCreditTableMissingCode({ code: "PGRST205" })).toBe("PGRST205");
    expect(walletCreditTableMissingCode({ code: "23505" })).toBeNull();
  });

  it("table missing means no transfer is created and the wallet is not debited", async () => {
    const { stripe, creates } = stripeDouble();
    let debited = false;
    const store: WalletCreditTransferStore = {
      async findByBookingId() {
        throw new WalletCreditTableMissingError("42P01");
      },
      async insert() {
        throw new WalletCreditTableMissingError("PGRST205");
      },
      async update() {
        throw new Error("update should not run");
      },
    };
    const paid = await payDoctorWalletCreditShare(credit, { stripe, store });
    await expect(
      settlePartCreditAfterCardPayment(
        {
          patientId: "pat-1",
          currency: "GBP",
          bookingId: BOOKING_ID,
          bookingNumber: "MD-100",
          doctorId: DOCTOR_ID,
          stripeAccountId: "acct_doc",
          creditAmountCents: 4000,
          description: "Wallet credit applied to booking MD-100",
        },
        {
          stripe,
          store,
          debit: async () => {
            debited = true;
          },
        }
      )
    ).rejects.toThrow();
    const settled = await runFullCreditSettlement(
      {
        stripeAccountId: "acct_doc",
        accounts: accounts({ card_payments: "active", transfers: "active" }),
        credit: settlementCredit(),
        debit: async () => {
          debited = true;
        },
        restoreWallet: async () => {
          throw new Error("nothing to restore");
        },
      },
      { stripe, store }
    );
    expect(paid.ok).toBe(false);
    expect(settled.ok).toBe(false);
    expect(debited).toBe(false);
    expect(creates).toHaveLength(0);
  });

  it("insert fails before transfer", async () => {
    const { stripe, creates } = stripeDouble();
    let debited = false;
    const store: WalletCreditTransferStore = {
      async findByBookingId() {
        return null;
      },
      async insert() {
        throw new Error("insert failed");
      },
      async update() {
        throw new Error("update should not run");
      },
    };
    const paid = await payDoctorWalletCreditShare(credit, { stripe, store });
    const settled = await runFullCreditSettlement(
      {
        stripeAccountId: "acct_doc",
        accounts: accounts({ card_payments: "active", transfers: "active" }),
        credit: settlementCredit(),
        debit: async () => {
          debited = true;
        },
        restoreWallet: async () => {},
      },
      { stripe, store }
    );
    expect(paid.ok).toBe(false);
    expect(settled.ok).toBe(false);
    expect(debited).toBe(false);
    expect(creates).toHaveLength(0);
  });

  it("leaves the row pending when the transfer fails, returns the wallet credit, and does not confirm", async () => {
    const store = memoryStore();
    const { stripe, creates } = stripeDouble();
    stripe.transfers.create = async () => {
      creates.push({ params: {}, options: {} });
      throw new Error("stripe down");
    };
    let restored = false;
    const settled = await runFullCreditSettlement(
      {
        stripeAccountId: "acct_doc",
        accounts: accounts({ card_payments: "active", transfers: "active" }),
        credit: settlementCredit(),
        debit: async () => {},
        restoreWallet: async () => {
          restored = true;
        },
      },
      { stripe, store }
    );
    expect(settled.ok).toBe(false);
    expect(restored).toBe(true);
    expect(creates).toHaveLength(1);
    expect(await store.findByBookingId(BOOKING_ID)).toMatchObject({
      status: "pending",
      stripe_transfer_id: null,
      amount_cents: 8500,
    });
  });

  it("resumes a pending row with the same idempotency key", async () => {
    const store = memoryStore();
    const { stripe, creates } = stripeDouble();
    let fail = true;
    stripe.transfers.create = async (params, options) => {
      creates.push({ params, options });
      if (fail) {
        fail = false;
        throw new Error("stripe down");
      }
      return { id: "tr_resumed" };
    };
    const first = await payDoctorWalletCreditShare(credit, { stripe, store });
    expect(first.ok).toBe(false);
    expect(await store.findByBookingId(BOOKING_ID)).toMatchObject({
      status: "pending",
    });
    const second = await payDoctorWalletCreditShare(credit, { stripe, store });
    expect(second).toEqual({
      ok: true,
      transferId: "tr_resumed",
      alreadyPaid: false,
    });
    expect(creates).toHaveLength(2);
    expect(creates[0]?.options).toEqual(creates[1]?.options);
    expect(creates[0]?.options).toEqual({
      idempotencyKey: walletCreditShareIdempotencyKey(BOOKING_ID),
    });
    expect(await store.findByBookingId(BOOKING_ID)).toMatchObject({
      status: "paid",
      stripe_transfer_id: "tr_resumed",
    });
  });
});

describe("part-credit booking pays the credit share after the card succeeds", () => {
  it("transfers 85% of the credit once, after the debit", async () => {
    const store = memoryStore();
    const { stripe, creates } = stripeDouble();
    let debited = false;
    let debitCalls = 0;
    const deps = {
      stripe,
      store,
      alreadyDebited: async () => debited,
      debit: async () => {
        debitCalls += 1;
        debited = true;
      },
    };
    const input = {
      patientId: "pat-1",
      currency: "GBP",
      bookingId: BOOKING_ID,
      bookingNumber: "MD-100",
      doctorId: DOCTOR_ID,
      stripeAccountId: "acct_doc",
      creditAmountCents: 4000,
      description: "Wallet credit applied to booking MD-100",
    };

    const first = await settlePartCreditAfterCardPayment(input, deps);
    const second = await settlePartCreditAfterCardPayment(input, deps);

    expect(first).toEqual({ transferId: "tr_1", alreadyPaid: false });
    expect(second).toEqual({ transferId: "tr_1", alreadyPaid: true });
    expect(debitCalls).toBe(1);
    expect(creates).toHaveLength(1);
    expect(creates[0]?.params.amount).toBe(3400);
    expect(creates[0]?.params.metadata).toMatchObject({
      credit_amount_cents: "4000",
      commission_cents: "600",
      kind: WALLET_CREDIT_SHARE_KIND,
    });
    expect(await store.findByBookingId(BOOKING_ID)).toMatchObject({
      amount_cents: 3400,
      credit_amount_cents: 4000,
      commission_cents: 600,
      status: "paid",
    });
  });
});

describe("refunds reverse the credit transfer and the card charge", () => {
  async function seedPartCredit(store: WalletCreditTransferStore) {
    await store.insert({
      booking_id: BOOKING_ID,
      doctor_id: DOCTOR_ID,
      amount_cents: 3400,
      credit_amount_cents: 4000,
      commission_cents: 600,
      stripe_transfer_id: "tr_seed",
      status: "paid",
      statement_line: PAID_WITH_WALLET_CREDIT_LINE,
      currency: "GBP",
      reversed_cents: 0,
      kind: WALLET_CREDIT_SHARE_KIND,
    });
  }

  it("reverses the whole credit transfer and refunds the card charge", async () => {
    const store = memoryStore();
    await seedPartCredit(store);
    const { stripe, refunds, reversals } = stripeDouble();

    const result = await refundConsultCardAndCreditShare(
      {
        paymentIntentId: "pi_card",
        cardRefundCents: 6000,
        bookingId: BOOKING_ID,
        refundAmountCents: 10000,
        paidAmountCents: 10000,
      },
      { stripe, store }
    );

    expect(result).toEqual({ cardRefundId: "re_test", reversedCents: 3400 });
    expect(refunds).toEqual([
      {
        payment_intent: "pi_card",
        amount: 6000,
        reverse_transfer: true,
        refund_application_fee: true,
      },
    ]);
    expect(reversals[0]).toMatchObject({
      id: "tr_seed",
      params: { amount: 3400 },
    });
    expect(await store.findByBookingId(BOOKING_ID)).toMatchObject({
      status: "reversed",
      reversed_cents: 3400,
    });
  });

  it("reverses a proportional slice on a partial refund and does not pay twice if repeated in full", async () => {
    expect(
      proportionalCreditTransferReversalCents({
        transferAmountCents: 3400,
        alreadyReversedCents: 0,
        refundAmountCents: 5000,
        paidAmountCents: 10000,
      })
    ).toBe(1700);

    const store = memoryStore();
    await seedPartCredit(store);
    const { stripe, reversals, refunds } = stripeDouble();
    const deps = { stripe, store };

    const partial = await refundConsultCardAndCreditShare(
      {
        paymentIntentId: "pi_card",
        cardRefundCents: 3000,
        bookingId: BOOKING_ID,
        refundAmountCents: 5000,
        paidAmountCents: 10000,
      },
      deps
    );
    expect(partial.reversedCents).toBe(1700);
    expect(refunds[0]).toMatchObject({
      amount: 3000,
      reverse_transfer: true,
      refund_application_fee: true,
    });
    expect(await store.findByBookingId(BOOKING_ID)).toMatchObject({
      status: "partially_reversed",
      reversed_cents: 1700,
    });

    const rest = await refundConsultCardAndCreditShare(
      {
        paymentIntentId: "pi_card",
        cardRefundCents: 3000,
        bookingId: BOOKING_ID,
        refundAmountCents: 5000,
        paidAmountCents: 10000,
      },
      deps
    );
    expect(rest.reversedCents).toBe(1700);
    expect(reversals).toHaveLength(2);
    expect(await store.findByBookingId(BOOKING_ID)).toMatchObject({
      status: "reversed",
      reversed_cents: 3400,
    });
  });

  it("full-credit refund reverses the transfer and does not invent a card refund", async () => {
    const store = memoryStore();
    const paid = stripeDouble();
    await payDoctorWalletCreditShare(
      {
        bookingId: BOOKING_ID,
        bookingNumber: "MD-100",
        doctorId: DOCTOR_ID,
        stripeAccountId: "acct_doc",
        currency: "gbp",
        creditAmountCents: 10000,
        commissionCents: 1500,
        amountCents: 8500,
      },
      { stripe: paid.stripe, store }
    );
    const refund = stripeDouble();
    const settled = await refundConsultCardAndCreditShare(
      {
        paymentIntentId: null,
        cardRefundCents: 0,
        bookingId: BOOKING_ID,
        refundAmountCents: 10000,
        paidAmountCents: 10000,
      },
      { stripe: refund.stripe, store }
    );
    expect(paid.creates).toHaveLength(1);
    expect(settled.cardRefundId).toBeNull();
    expect(settled.reversedCents).toBe(8500);
    expect(refund.refunds).toHaveLength(0);
    expect(refund.reversals[0]).toMatchObject({
      params: { amount: 8500 },
    });
  });
});

describe("a doctor who cannot take payments is not paid and the wallet is not debited", () => {
  const credit = {
    bookingId: BOOKING_ID,
    bookingNumber: "MD-100",
    doctorId: DOCTOR_ID,
    currency: "GBP",
    creditAmountCents: 10000,
    commissionCents: 1500,
    amountCents: 8500,
  };

  it.each([
    ["missing account", null, { card_payments: "active", transfers: "active" }],
    ["card_payments pending", "acct_doc", { card_payments: "pending", transfers: "active" }],
    ["transfers inactive", "acct_doc", { card_payments: "active", transfers: "inactive" }],
    ["transfers missing", "acct_doc", { card_payments: "active" }],
  ] as const)("%s", async (_label, accountId, caps) => {
    const { stripe, creates } = stripeDouble();
    let debited = false;
    const result = await runFullCreditSettlement(
      {
        stripeAccountId: accountId,
        accounts: accounts(caps),
        credit,
        debit: async () => {
          debited = true;
        },
        restoreWallet: async () => {},
      },
      { stripe, store: memoryStore() }
    );
    expect(result).toEqual({
      ok: false,
      error: DOCTOR_CARD_PAYMENTS_UNAVAILABLE_MESSAGE,
    });
    expect(debited).toBe(false);
    expect(creates).toHaveLength(0);
  });

  it("fails closed when Stripe cannot be read", async () => {
    let debited = false;
    const result = await runFullCreditSettlement({
      stripeAccountId: "acct_doc",
      accounts: accounts("throw"),
      credit,
      debit: async () => {
        debited = true;
      },
      restoreWallet: async () => {},
    });
    expect(result.ok).toBe(false);
    expect(debited).toBe(false);
  });
});

describe("credit payout is wired into consult checkout, not the other products", () => {
  it("full-credit confirm returns the wallet credit and does not confirm when settlement fails", () => {
    const booking = read("src/actions/booking.ts");
    const fn = booking.slice(
      booking.indexOf("export async function createBookingAndCheckout")
    );
    const branch = fn.slice(
      fn.indexOf("remainingCharge === 0 && walletCreditToApply > 0"),
      fn.indexOf("walletOnly: true")
    );
    expect(branch.indexOf("runFullCreditSettlement")).toBeGreaterThan(-1);
    expect(branch).toContain("await debitWallet(");
    expect(branch).toContain("restoreWallet:");
    expect(branch).toContain("await creditWallet(");
    const refused = branch.slice(
      branch.indexOf("if (!fullCredit.ok)"),
      branch.indexOf("BOOKING_STATUSES.CONFIRMED")
    );
    expect(refused).toContain("return { error: fullCredit.error }");
    expect(refused).not.toContain("BOOKING_STATUSES.CONFIRMED");
    expect(branch).toContain("commission_cents: checkoutMoney.commissionCents");
  });

  it("part-credit checkout fees the card only and blocks before reserving credit", () => {
    const booking = read("src/actions/booking.ts");
    const fn = booking.slice(
      booking.indexOf("export async function createBookingAndCheckout")
    );
    const cardGate = fn.indexOf("return { error: merchant.error }");
    const creditGate = fn.indexOf("await doctorCanReceiveConsultCreditPayment");
    const creditReturn = fn.indexOf("creditPayee.error");
    const reserve = fn.indexOf(
      ".update({ wallet_credit_applied_cents: walletCreditToApply })"
    );
    const session = fn.indexOf("checkout.sessions.create");
    expect(creditGate).toBeGreaterThan(cardGate);
    expect(creditReturn).toBeGreaterThan(creditGate);
    expect(reserve).toBeGreaterThan(creditReturn);
    expect(session).toBeGreaterThan(reserve);
    expect(fn).toContain(
      "application_fee_amount: checkoutMoney.applicationFeeCents"
    );
    expect(fn).toContain("commission_cents: checkoutMoney.commissionCents");
    expect(fn).not.toContain("Math.min(applicationFeeCents, remainingCharge)");
  });

  it("webhook settles the credit share on checkout.session.completed after confirm", () => {
    const webhook = read("src/app/api/webhooks/stripe/route.ts");
    const start = webhook.indexOf(
      'else if (bookingId && session.mode === "payment")'
    );
    const end = webhook.indexOf('case "customer.subscription.created"');
    const branch = webhook.slice(start, end);
    const confirm = branch.indexOf('status: "confirmed"');
    const settle = branch.indexOf("settlePartCreditAfterCardPayment");
    expect(confirm).toBeGreaterThan(-1);
    expect(settle).toBeGreaterThan(confirm);
    expect(branch).not.toContain("debitWallet");
  });

  it("patient, admin, and GP refunds reverse the credit share with the card charge", () => {
    for (const rel of [
      "src/actions/booking.ts",
      "src/actions/admin.ts",
      "src/lib/gp/reassign.ts",
    ]) {
      expect(read(rel), rel).toContain("refundConsultCardAndCreditShare");
    }
    const helper = read("src/lib/stripe/wallet-credit-share.ts");
    expect(helper).toContain("reverse_transfer: true");
    expect(helper).toContain("refund_application_fee: true");
    expect(helper).toContain("reverseConnectTransfer");
    const handoff = read("src/lib/stripe/transfer-handoff.ts");
    const gp = handoff.slice(
      handoff.indexOf("export async function handoffConnectTransfer")
    );
    expect(gp).toContain("reverseConnectTransfer(");
    expect(gp).toContain("createConnectTransfer(");
  });

  it("leaves softsmoke, treatment plans, invoices, and clinic reschedule alone", () => {
    const booking = read("src/actions/booking.ts");
    expect(booking.indexOf("isSoftsmokeConnectChargeSkipped")).toBeLessThan(
      booking.indexOf("runFullCreditSettlement")
    );
    expect(booking).toContain("confirmBookingWithoutStripeCheckout");
    for (const rel of [
      "src/actions/treatment-plan.ts",
      "src/actions/invoices.ts",
      "src/actions/clinic-booking.ts",
      "src/actions/wallet.ts",
    ]) {
      expect(read(rel), rel).not.toContain("wallet-credit-share");
      expect(read(rel), rel).not.toContain("settlePartCreditAfterCardPayment");
    }
    expect(read("src/actions/treatment-plan.ts")).toContain("isCarePlansEnabled");
    expect(read("src/actions/clinic-booking.ts")).not.toContain("on_behalf_of");
  });
});
