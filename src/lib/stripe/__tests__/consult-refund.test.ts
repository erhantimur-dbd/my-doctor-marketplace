import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CREDIT_REASSIGNMENT_BLOCKED_MESSAGE,
  clawbackCardDestinationShare,
  clinicianReassignmentBlockReason,
  consultCardClawbackIdempotencyKey,
  bookingRefundSettlementPatch,
  cheaperReschedulePaidRebasePatch,
  remainingConsultPaidParts,
  proportionalCardTransferClawbackCents,
  refundAdminBookingPayment,
  refundClinicCancellation,
  refundConsultSplit,
  splitConsultRefund,
  storedConsultPaidParts,
  type ConsultRefundDeps,
  type ConsultRefundWallet,
} from "@/lib/stripe/consult-refund";
import {
  PAID_WITH_WALLET_CREDIT_LINE,
  WALLET_CREDIT_SHARE_KIND,
  consultCardRefundIdempotencyKey,
  type WalletCreditTransferRecord,
  type WalletCreditTransferStore,
} from "@/lib/stripe/wallet-credit-share";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const BOOKING_ID = "book-refund-1";

function memoryStore(): WalletCreditTransferStore {
  const rows = new Map<string, WalletCreditTransferRecord>();
  return {
    async findByBookingId(bookingId) {
      return rows.get(bookingId) ?? null;
    },
    async insert(row) {
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

function memoryWallet(): ConsultRefundWallet & {
  credits: { description: string; amountCents: number; sourceType: string }[];
} {
  const credits: {
    description: string;
    amountCents: number;
    sourceType: string;
  }[] = [];
  return {
    credits,
    async findApplied(description) {
      return credits.some((row) => row.description === description);
    },
    async credit(input) {
      credits.push({
        description: input.description,
        amountCents: input.amountCents,
        sourceType: input.sourceType,
      });
    },
  };
}

function stripeDouble() {
  const refunds: { params: Record<string, unknown>; options?: { idempotencyKey?: string } }[] =
    [];
  const reversals: { id: string; params?: unknown; options?: { idempotencyKey?: string } }[] =
    [];
  const seenRefunds = new Map<string, { id: string }>();
  const seenReversals = new Map<string, { id: string }>();
  const stripe = {
    refunds: {
      async create(
        params: {
          payment_intent: string;
          amount: number;
          reverse_transfer: boolean;
          refund_application_fee: boolean;
        },
        options?: { idempotencyKey?: string }
      ) {
        const key = options?.idempotencyKey;
        if (key && seenRefunds.has(key)) {
          return seenRefunds.get(key)!;
        }
        refunds.push({ params, options });
        const created = { id: `re_${refunds.length}` };
        if (key) seenRefunds.set(key, created);
        return created;
      },
    },
    transfers: {
      async create() {
        return { id: "tr_unused" };
      },
      async createReversal(
        id: string,
        params?: { amount?: number },
        options?: { idempotencyKey?: string }
      ) {
        const key = options?.idempotencyKey;
        if (key && seenReversals.has(key)) {
          return seenReversals.get(key)!;
        }
        reversals.push({ id, params, options });
        const created = { id: `trr_${reversals.length}` };
        if (key) seenReversals.set(key, created);
        return created;
      },
    },
  };
  return { stripe, refunds, reversals };
}

async function seedTransfer(
  store: WalletCreditTransferStore,
  input: {
    amountCents: number;
    creditAmountCents: number;
    commissionCents: number;
  }
) {
  await store.insert({
    booking_id: BOOKING_ID,
    doctor_id: "doc-1",
    amount_cents: input.amountCents,
    credit_amount_cents: input.creditAmountCents,
    commission_cents: input.commissionCents,
    stripe_transfer_id: "tr_credit",
    status: "paid",
    statement_line: PAID_WITH_WALLET_CREDIT_LINE,
    currency: "GBP",
    reversed_cents: 0,
    kind: WALLET_CREDIT_SHARE_KIND,
  });
}

function destinationHarness(store: WalletCreditTransferStore) {
  const wallet = memoryWallet();
  const stripe = stripeDouble();
  const deps: ConsultRefundDeps = {
    stripe: stripe.stripe,
    store,
    wallet,
    async findTransfer() {
      return { transferId: "tr_dest", amount: 5100, currency: "gbp" };
    },
  };
  return { wallet, stripe, deps };
}

function harness(store: WalletCreditTransferStore) {
  const wallet = memoryWallet();
  const stripe = stripeDouble();
  const clawbacks: { cardRefundCents: number; idempotencyKey: string }[] = [];
  const deps: ConsultRefundDeps = {
    stripe: stripe.stripe,
    store,
    wallet,
    async clawbackCardShare(input) {
      clawbacks.push({
        cardRefundCents: input.cardRefundCents,
        idempotencyKey: input.idempotencyKey,
      });
      return {
        reversalId: "trr_card",
        reversedCents: input.cardRefundCents,
        transferFound: true,
      };
    },
  };
  return { wallet, stripe, clawbacks, deps };
}

describe("stored card and credit amounts", () => {
  it("splits a percentage across each stored part, not the consultation total", () => {
    const parts = storedConsultPaidParts({
      payment_mode: "deposit",
      deposit_amount_cents: 3000,
      total_amount_cents: 10000,
      wallet_credit_applied_cents: 1000,
    });
    expect(parts).toEqual({ cardPaidCents: 2000, creditPaidCents: 1000 });
    expect(
      splitConsultRefund({ ...parts, refundPercent: 50 })
    ).toEqual({ cardRefundCents: 1000, creditRefundCents: 500 });
  });
});

describe("consult refund split", () => {
  it("full-credit refund with bank returns the credit to the wallet and reverses the transfer", async () => {
    const store = memoryStore();
    await seedTransfer(store, {
      amountCents: 8500,
      creditAmountCents: 10000,
      commissionCents: 1500,
    });
    const { wallet, stripe, clawbacks, deps } = harness(store);

    const result = await refundConsultSplit(
      {
        bookingId: BOOKING_ID,
        bookingNumber: "MD-100",
        patientId: "pat-1",
        currency: "GBP",
        destination: "bank",
        paymentIntentId: null,
        cardPaidCents: 0,
        creditPaidCents: 10000,
        refundPercent: 100,
      },
      deps
    );

    expect(result.walletCreditCents).toBe(10000);
    expect(result.cardRefundedToCardCents).toBe(0);
    expect(result.cardRefundId).toBeNull();
    expect(result.reversedCents).toBe(8500);
    expect(wallet.credits).toEqual([
      expect.objectContaining({ amountCents: 10000, sourceType: "refund" }),
    ]);
    expect(stripe.refunds).toHaveLength(0);
    expect(stripe.reversals[0]).toMatchObject({
      id: "tr_credit",
      params: { amount: 8500 },
    });
    expect(clawbacks).toHaveLength(0);
    expect(await store.findByBookingId(BOOKING_ID)).toMatchObject({
      status: "reversed",
      reversed_cents: 8500,
    });
  });

  it("part-credit with bank refunds the card to the card and the credit to the wallet", async () => {
    const store = memoryStore();
    await seedTransfer(store, {
      amountCents: 3400,
      creditAmountCents: 4000,
      commissionCents: 600,
    });
    const { wallet, stripe, clawbacks, deps } = harness(store);

    const result = await refundConsultSplit(
      {
        bookingId: BOOKING_ID,
        bookingNumber: "MD-200",
        patientId: "pat-1",
        currency: "GBP",
        destination: "bank",
        paymentIntentId: "pi_card",
        cardPaidCents: 6000,
        creditPaidCents: 4000,
        refundPercent: 100,
      },
      deps
    );

    expect(result.cardRefundedToCardCents).toBe(6000);
    expect(result.walletCreditCents).toBe(4000);
    expect(result.reversedCents).toBe(3400);
    expect(wallet.credits.map((row) => row.amountCents)).toEqual([4000]);
    expect(stripe.refunds).toEqual([
      {
        params: {
          payment_intent: "pi_card",
          amount: 6000,
          reverse_transfer: true,
          refund_application_fee: true,
        },
        options: {
          idempotencyKey: consultCardRefundIdempotencyKey(BOOKING_ID, 6000, 0),
        },
      },
    ]);
    expect(clawbacks).toHaveLength(0);
  });

  it("part-credit with wallet returns both parts as credit and reverses the destination transfer instead of refunding", async () => {
    const store = memoryStore();
    await seedTransfer(store, {
      amountCents: 3400,
      creditAmountCents: 4000,
      commissionCents: 600,
    });
    const { wallet, stripe, deps } = destinationHarness(store);

    const result = await refundConsultSplit(
      {
        bookingId: BOOKING_ID,
        bookingNumber: "MD-200",
        patientId: "pat-1",
        currency: "GBP",
        destination: "wallet",
        paymentIntentId: "pi_card",
        cardPaidCents: 6000,
        creditPaidCents: 4000,
        refundPercent: 100,
        sourceType: "cancel_rebook",
      },
      deps
    );

    expect(result.walletCreditCents).toBe(10000);
    expect(result.cardRefundedToCardCents).toBe(0);
    expect(result.cardRefundId).toBeNull();
    expect(result.cardClawbackCents).toBe(5100);
    expect(result.reversedCents).toBe(3400);
    expect(wallet.credits).toEqual([
      expect.objectContaining({ amountCents: 10000, sourceType: "cancel_rebook" }),
    ]);
    expect(stripe.refunds).toHaveLength(0);
    const cardReversal = stripe.reversals.filter((row) => row.id === "tr_dest");
    expect(cardReversal).toEqual([
      {
        id: "tr_dest",
        params: expect.objectContaining({ amount: 5100 }),
        options: {
          idempotencyKey: consultCardClawbackIdempotencyKey(BOOKING_ID, 6000),
        },
      },
    ]);
    expect(stripe.reversals.filter((row) => row.id === "tr_credit")).toHaveLength(1);
  });

  it("applies a 50% refund in proportion to the card, the credit, and the transfer", async () => {
    const store = memoryStore();
    await seedTransfer(store, {
      amountCents: 3400,
      creditAmountCents: 4000,
      commissionCents: 600,
    });
    const { wallet, stripe, deps } = harness(store);

    const result = await refundConsultSplit(
      {
        bookingId: BOOKING_ID,
        bookingNumber: "MD-200",
        patientId: "pat-1",
        currency: "GBP",
        destination: "bank",
        paymentIntentId: "pi_card",
        cardPaidCents: 6000,
        creditPaidCents: 4000,
        refundPercent: 50,
      },
      deps
    );

    expect(result.cardRefundedToCardCents).toBe(3000);
    expect(result.creditRefundCents).toBe(2000);
    expect(result.walletCreditCents).toBe(2000);
    expect(result.reversedCents).toBe(1700);
    expect(stripe.refunds[0]?.params).toMatchObject({
      amount: 3000,
      reverse_transfer: true,
      refund_application_fee: true,
    });
    expect(wallet.credits.map((row) => row.amountCents)).toEqual([2000]);
    expect(await store.findByBookingId(BOOKING_ID)).toMatchObject({
      status: "partially_reversed",
      reversed_cents: 1700,
    });
  });

  it("replays the same refund without a second wallet credit, card refund, or transfer reversal", async () => {
    const store = memoryStore();
    await seedTransfer(store, {
      amountCents: 3400,
      creditAmountCents: 4000,
      commissionCents: 600,
    });
    const { wallet, stripe, clawbacks, deps } = harness(store);
    const input = {
      bookingId: BOOKING_ID,
      bookingNumber: "MD-200",
      patientId: "pat-1",
      currency: "GBP",
      destination: "bank" as const,
      paymentIntentId: "pi_card",
      cardPaidCents: 6000,
      creditPaidCents: 4000,
      refundPercent: 100,
    };

    const first = await refundConsultSplit(input, deps);
    const second = await refundConsultSplit(input, deps);

    expect(first.alreadyApplied).toBe(false);
    expect(second.alreadyApplied).toBe(true);
    expect(second.walletCreditCents).toBe(4000);
    expect(wallet.credits).toHaveLength(1);
    expect(stripe.refunds).toHaveLength(1);
    expect(stripe.reversals).toHaveLength(1);
    expect(clawbacks).toHaveLength(0);
    expect(await store.findByBookingId(BOOKING_ID)).toMatchObject({
      reversed_cents: 3400,
    });
  });
});

describe("clinic cancel and admin refund", () => {
  it("clinic cancel of a part-credit booking returns the card to the card and the credit to the wallet", async () => {
    const store = memoryStore();
    await seedTransfer(store, {
      amountCents: 3400,
      creditAmountCents: 4000,
      commissionCents: 600,
    });
    const { wallet, stripe, deps } = harness(store);

    const result = await refundClinicCancellation(
      {
        id: BOOKING_ID,
        booking_number: "MD-200",
        patient_id: "pat-1",
        currency: "GBP",
        stripe_payment_intent_id: "pi_card",
        total_amount_cents: 10000,
        wallet_credit_applied_cents: 4000,
        paid_at: "2026-09-26T12:00:00.000Z",
      },
      deps
    );

    expect(result.refundAmountCents).toBe(10000);
    expect(result.cardRefundedToCardCents).toBe(6000);
    expect(result.walletCreditCents).toBe(4000);
    expect(result.reversedCents).toBe(3400);
    expect(stripe.refunds[0]?.params).toMatchObject({
      amount: 6000,
      reverse_transfer: true,
      refund_application_fee: true,
    });
    expect(wallet.credits.map((row) => row.amountCents)).toEqual([4000]);
  });

  it("admin refund of a full-credit booking does not require a card payment", async () => {
    const store = memoryStore();
    await seedTransfer(store, {
      amountCents: 8500,
      creditAmountCents: 10000,
      commissionCents: 1500,
    });
    const { wallet, stripe, deps } = harness(store);

    const result = await refundAdminBookingPayment(
      {
        id: BOOKING_ID,
        booking_number: "MD-100",
        patient_id: "pat-1",
        currency: "GBP",
        stripe_payment_intent_id: null,
        total_amount_cents: 10000,
        wallet_credit_applied_cents: 10000,
        paid_at: "2026-09-26T12:00:00.000Z",
        refunded_at: null,
      },
      undefined,
      deps
    );

    expect(result).toMatchObject({
      refundAmountCents: 10000,
      walletCreditCents: 10000,
      cardRefundedToCardCents: 0,
      reversedCents: 8500,
    });
    expect("error" in result && result.error).toBeFalsy();
    expect(stripe.refunds).toHaveLength(0);
    expect(wallet.credits.map((row) => row.amountCents)).toEqual([10000]);
  });
});

describe("moving a credit booking to another clinician", () => {
  it("blocks wallet-credit bookings and allows card-only bookings", () => {
    expect(
      clinicianReassignmentBlockReason({ wallet_credit_applied_cents: 4000 })
    ).toBe(CREDIT_REASSIGNMENT_BLOCKED_MESSAGE);
    expect(
      clinicianReassignmentBlockReason({ wallet_credit_applied_cents: 10000 })
    ).toBe(CREDIT_REASSIGNMENT_BLOCKED_MESSAGE);
    expect(
      clinicianReassignmentBlockReason({ wallet_credit_applied_cents: 0 })
    ).toBeNull();
    expect(clinicianReassignmentBlockReason({})).toBeNull();

    const gp = read("src/lib/gp/reassign.ts");
    const request = gp.slice(
      gp.indexOf("export async function executeGpReassignmentRequest")
    );
    const requestGuard = request.indexOf("clinicianReassignmentBlockReason");
    const requestSearch = request.indexOf("findSameSlotGpReplacements");
    expect(requestGuard).toBeGreaterThan(-1);
    expect(requestSearch).toBeGreaterThan(requestGuard);

    const accept = gp.slice(gp.indexOf("export async function acceptGpSlotOffer"));
    const acceptGuard = accept.indexOf("clinicianReassignmentBlockReason");
    const acceptHandoff = accept.indexOf("applyDoctorHandoff");
    expect(acceptGuard).toBeGreaterThan(-1);
    expect(acceptHandoff).toBeGreaterThan(acceptGuard);

    const clinic = read("src/actions/clinic-booking.ts");
    const reschedule = clinic.slice(
      clinic.indexOf("export async function adminRescheduleBooking")
    );
    const clinicGuard = reschedule.indexOf("clinicianReassignmentBlockReason");
    expect(clinicGuard).toBeGreaterThan(-1);
    expect(reschedule.slice(0, clinicGuard)).toContain(
      "parsed.data.new_doctor_id !== booking.doctor_id"
    );
  });
});

describe("wallet-destination card clawback", () => {
  it("reverses the doctor's card transfer in proportion, with an idempotency key", async () => {
    expect(
      proportionalCardTransferClawbackCents({
        transferAmountCents: 5100,
        cardPaidCents: 6000,
        cardRefundCents: 3000,
      })
    ).toBe(2550);

    const reversals: { amountCents?: number; idempotencyKey: string }[] = [];
    const result = await clawbackCardDestinationShare(
      {
        paymentIntentId: "pi_card",
        bookingId: BOOKING_ID,
        cardPaidCents: 6000,
        cardRefundCents: 3000,
        idempotencyKey: consultCardClawbackIdempotencyKey(BOOKING_ID, 3000),
      },
      {
        async findTransfer() {
          return { transferId: "tr_card", amount: 5100, currency: "gbp" };
        },
        async reverseTransfer(input) {
          reversals.push({
            amountCents: input.amountCents,
            idempotencyKey: input.idempotencyKey,
          });
          return { reversalId: "trr_card" };
        },
      }
    );

    expect(result).toEqual({
      reversalId: "trr_card",
      reversedCents: 2550,
      transferFound: true,
    });
    expect(reversals).toEqual([
      {
        amountCents: 2550,
        idempotencyKey: consultCardClawbackIdempotencyKey(BOOKING_ID, 3000),
      },
    ]);
    expect(consultCardClawbackIdempotencyKey(BOOKING_ID, 3000)).toBe(
      `wallet-refund-reversal-${BOOKING_ID}-0-3000`
    );
  });
});

describe("wallet destination never refunds the card", () => {
  async function walletRefund(input: {
    sourceType: "refund" | "cancel_rebook";
    refundPercent: number;
    creditPaidCents?: number;
    creditTransferCents?: number;
  }) {
    const store = memoryStore();
    if (input.creditPaidCents && input.creditTransferCents) {
      await seedTransfer(store, {
        amountCents: input.creditTransferCents,
        creditAmountCents: input.creditPaidCents,
        commissionCents: input.creditPaidCents - input.creditTransferCents,
      });
    }
    const { wallet, stripe, deps } = destinationHarness(store);
    const result = await refundConsultSplit(
      {
        bookingId: BOOKING_ID,
        bookingNumber: "MD-300",
        patientId: "pat-1",
        currency: "GBP",
        destination: "wallet",
        paymentIntentId: "pi_card",
        cardPaidCents: 6000,
        creditPaidCents: input.creditPaidCents ?? 0,
        refundPercent: input.refundPercent,
        sourceType: input.sourceType,
      },
      deps
    );
    return { result, wallet, stripe, store };
  }

  function cardReversals(
    reversals: { id: string; params?: unknown; options?: { idempotencyKey?: string } }[]
  ) {
    return reversals.filter((row) => row.id === "tr_dest");
  }

  it("cancel credits the card once and reverses the destination transfer once", async () => {
    const { result, wallet, stripe } = await walletRefund({
      sourceType: "refund",
      refundPercent: 100,
    });

    expect(result.walletCreditCents).toBe(6000);
    expect(result.cardClawbackCents).toBe(5100);
    expect(stripe.refunds).toHaveLength(0);
    expect(cardReversals(stripe.reversals)).toEqual([
      {
        id: "tr_dest",
        params: expect.objectContaining({ amount: 5100 }),
        options: {
          idempotencyKey: `wallet-refund-reversal-${BOOKING_ID}-0-6000`,
        },
      },
    ]);
    expect(wallet.credits).toEqual([
      expect.objectContaining({ amountCents: 6000, sourceType: "refund" }),
    ]);
  });

  it("cancel-and-rebook credits the card once and reverses the destination transfer once", async () => {
    const { result, wallet, stripe } = await walletRefund({
      sourceType: "cancel_rebook",
      refundPercent: 100,
    });

    expect(result.walletCreditCents).toBe(6000);
    expect(stripe.refunds).toHaveLength(0);
    expect(cardReversals(stripe.reversals)).toHaveLength(1);
    expect(cardReversals(stripe.reversals)[0]?.params).toMatchObject({ amount: 5100 });
    expect(wallet.credits).toEqual([
      expect.objectContaining({ amountCents: 6000, sourceType: "cancel_rebook" }),
    ]);
  });

  it("a partial wallet refund reverses the same proportion of the destination transfer", async () => {
    const { result, wallet, stripe } = await walletRefund({
      sourceType: "refund",
      refundPercent: 50,
      creditPaidCents: 4000,
      creditTransferCents: 3400,
    });

    expect(result.cardRefundCents).toBe(3000);
    expect(result.creditRefundCents).toBe(2000);
    expect(result.walletCreditCents).toBe(5000);
    expect(result.cardClawbackCents).toBe(2550);
    expect(stripe.refunds).toHaveLength(0);
    expect(cardReversals(stripe.reversals)).toEqual([
      {
        id: "tr_dest",
        params: expect.objectContaining({ amount: 2550 }),
        options: {
          idempotencyKey: `wallet-refund-reversal-${BOOKING_ID}-0-3000`,
        },
      },
    ]);
    expect(stripe.reversals.filter((row) => row.id === "tr_credit")).toEqual([
      expect.objectContaining({ params: expect.objectContaining({ amount: 1700 }) }),
    ]);
    expect(wallet.credits).toEqual([
      expect.objectContaining({ amountCents: 5000, sourceType: "refund" }),
    ]);
  });

  it("a replay does not reverse the destination transfer or credit the wallet again", async () => {
    const store = memoryStore();
    const { wallet, stripe, deps } = destinationHarness(store);
    const input = {
      bookingId: BOOKING_ID,
      bookingNumber: "MD-300",
      patientId: "pat-1",
      currency: "GBP",
      destination: "wallet" as const,
      paymentIntentId: "pi_card",
      cardPaidCents: 6000,
      creditPaidCents: 0,
      refundPercent: 100,
      sourceType: "refund" as const,
    };

    const first = await refundConsultSplit(input, deps);
    const second = await refundConsultSplit(input, deps);

    expect(first.alreadyApplied).toBe(false);
    expect(second.alreadyApplied).toBe(true);
    expect(stripe.refunds).toHaveLength(0);
    expect(cardReversals(stripe.reversals)).toHaveLength(1);
    expect(wallet.credits).toHaveLength(1);
  });

  it("cancel and cancel-and-rebook both use the split, and neither refunds the card itself", () => {
    const booking = read("src/actions/booking.ts");
    const cancel = booking.slice(
      booking.indexOf("export async function cancelBooking"),
      booking.indexOf("export async function cancelAndRebook")
    );
    const rebook = booking.slice(booking.indexOf("export async function cancelAndRebook"));
    expect(cancel).toContain("refundConsultSplit");
    expect(cancel).toContain("bookingRefundSettlementPatch");
    expect(cancel).not.toContain("refunds.create");
    expect(cancel).not.toContain("creditWallet(");
    expect(rebook).toContain('destination: "wallet"');
    expect(rebook).toContain("refundConsultSplit");
    expect(rebook).toContain("bookingRefundSettlementPatch");
    expect(rebook).not.toContain("refunds.create");
    expect(rebook).not.toContain("creditWallet(");
  });

  it("two equal credit slices reverse the transfer both times", async () => {
    const store = memoryStore();
    await seedTransfer(store, {
      amountCents: 8500,
      creditAmountCents: 10000,
      commissionCents: 1500,
    });
    const { wallet, stripe, deps } = harness(store);

    const first = await refundConsultSplit(
      {
        bookingId: BOOKING_ID,
        bookingNumber: "MD-SEQ",
        patientId: "pat-1",
        currency: "GBP",
        destination: "bank",
        paymentIntentId: null,
        cardPaidCents: 0,
        creditPaidCents: 10000,
        refundPercent: 50,
        alreadyRefundedCents: 0,
      },
      deps
    );
    const second = await refundConsultSplit(
      {
        bookingId: BOOKING_ID,
        bookingNumber: "MD-SEQ",
        patientId: "pat-1",
        currency: "GBP",
        destination: "bank",
        paymentIntentId: null,
        cardPaidCents: 0,
        creditPaidCents: 10000,
        refundPercent: 50,
        alreadyRefundedCents: 5000,
      },
      deps
    );

    expect(first.walletCreditCents).toBe(5000);
    expect(second.walletCreditCents).toBe(5000);
    expect(first.alreadyApplied).toBe(false);
    expect(second.alreadyApplied).toBe(false);
    expect(stripe.reversals).toHaveLength(2);
    expect(await store.findByBookingId(BOOKING_ID)).toMatchObject({
      status: "reversed",
      reversed_cents: 8500,
    });
    expect(wallet.credits.map((row) => row.amountCents)).toEqual([5000, 5000]);
  });

  it("wallet cancel settlement blocks a later admin card refund of the same booking", async () => {
    const store = memoryStore();
    const { wallet, stripe, deps } = destinationHarness(store);

    const walletCancel = await refundConsultSplit(
      {
        bookingId: BOOKING_ID,
        bookingNumber: "MD-WLT",
        patientId: "pat-1",
        currency: "GBP",
        destination: "wallet",
        paymentIntentId: "pi_card",
        cardPaidCents: 6000,
        creditPaidCents: 4000,
        refundPercent: 100,
        sourceType: "cancel_rebook",
      },
      deps
    );
    const patch = bookingRefundSettlementPatch(
      {
        total_amount_cents: 10000,
        wallet_credit_applied_cents: 4000,
      },
      walletCancel
    );
    expect(patch).toMatchObject({
      card_credited_to_wallet_cents: 6000,
      credit_refunded_cents: 4000,
      refund_amount_cents: 10000,
    });
    expect(patch?.refunded_at).toBeTruthy();

    const admin = await refundAdminBookingPayment(
      {
        id: BOOKING_ID,
        booking_number: "MD-WLT",
        patient_id: "pat-1",
        currency: "GBP",
        stripe_payment_intent_id: "pi_card",
        total_amount_cents: 10000,
        wallet_credit_applied_cents: 4000,
        paid_at: "2026-09-26T12:00:00.000Z",
        refunded_at: patch?.refunded_at as string,
        refund_amount_cents: 10000,
        card_credited_to_wallet_cents: 6000,
        credit_refunded_cents: 4000,
      },
      undefined,
      deps
    );

    expect(admin).toEqual({ error: "Booking has already been refunded" });
    expect(stripe.refunds).toHaveLength(0);
    expect(wallet.credits).toHaveLength(1);
  });

  it("patient 50% bank then admin remaining does not collide on wallet description", async () => {
    const store = memoryStore();
    await seedTransfer(store, {
      amountCents: 3400,
      creditAmountCents: 4000,
      commissionCents: 600,
    });
    const { wallet, stripe, deps } = harness(store);

    const first = await refundConsultSplit(
      {
        bookingId: BOOKING_ID,
        bookingNumber: "MD-PART",
        patientId: "pat-1",
        currency: "GBP",
        destination: "bank",
        paymentIntentId: "pi_card",
        cardPaidCents: 6000,
        creditPaidCents: 4000,
        refundPercent: 50,
        alreadyRefundedCents: 0,
      },
      deps
    );
    const patch = bookingRefundSettlementPatch(
      {
        total_amount_cents: 10000,
        wallet_credit_applied_cents: 4000,
      },
      first
    );

    const admin = await refundAdminBookingPayment(
      {
        id: BOOKING_ID,
        booking_number: "MD-PART",
        patient_id: "pat-1",
        currency: "GBP",
        stripe_payment_intent_id: "pi_card",
        total_amount_cents: 10000,
        wallet_credit_applied_cents: 4000,
        paid_at: "2026-09-26T12:00:00.000Z",
        refunded_at: null,
        refund_amount_cents: Number(patch?.refund_amount_cents || 0),
        card_refunded_to_card_cents: Number(
          patch?.card_refunded_to_card_cents || 0
        ),
        credit_refunded_cents: Number(patch?.credit_refunded_cents || 0),
      },
      undefined,
      deps
    );

    expect("error" in admin).toBe(false);
    if ("error" in admin) return;
    expect(first.cardRefundedToCardCents).toBe(3000);
    expect(first.walletCreditCents).toBe(2000);
    expect(admin.cardRefundedToCardCents).toBe(3000);
    expect(admin.walletCreditCents).toBe(2000);
    expect(stripe.refunds).toHaveLength(2);
    expect(wallet.credits.map((row) => row.amountCents)).toEqual([2000, 2000]);
    expect(await store.findByBookingId(BOOKING_ID)).toMatchObject({
      reversed_cents: 3400,
    });
  });

  it("alreadyApplied still persists counters when the booking update never landed", () => {
    const patch = bookingRefundSettlementPatch(
      {
        total_amount_cents: 10000,
        wallet_credit_applied_cents: 4000,
      },
      {
        cardRefundCents: 6000,
        cardRefundedToCardCents: 0,
        creditRefundCents: 4000,
        walletCreditCents: 10000,
        alreadyApplied: true,
      }
    );
    expect(patch).toMatchObject({
      card_credited_to_wallet_cents: 6000,
      credit_refunded_cents: 4000,
      refund_amount_cents: 10000,
    });
    expect(patch?.refunded_at).toBeTruthy();

    const second = bookingRefundSettlementPatch(
      {
        total_amount_cents: 10000,
        wallet_credit_applied_cents: 4000,
        card_credited_to_wallet_cents: 6000,
        credit_refunded_cents: 4000,
        refund_amount_cents: 10000,
      },
      {
        cardRefundCents: 6000,
        cardRefundedToCardCents: 0,
        creditRefundCents: 4000,
        walletCreditCents: 10000,
        alreadyApplied: true,
      }
    );
    expect(second).toBeNull();
  });

  it("cheaper reschedule rebase keeps later remaining refunds aligned to the new fee", () => {
    const rebase = cheaperReschedulePaidRebasePatch({
      originalTotalCents: 10000,
      refundCents: 2000,
      walletCreditAppliedCents: 4000,
      settled: {
        cardRefundedToCardCents: 1200,
        creditRefundCents: 800,
        walletCreditCents: 800,
      },
      priorRefundAmountCents: 0,
    });
    expect(rebase).toMatchObject({
      total_amount_cents: 8000,
      wallet_credit_applied_cents: 3200,
      card_refunded_to_card_cents: 0,
      card_credited_to_wallet_cents: 0,
      credit_refunded_cents: 0,
      refund_amount_cents: 2000,
    });
    const remaining = remainingConsultPaidParts({
      total_amount_cents: rebase.total_amount_cents as number,
      wallet_credit_applied_cents: rebase.wallet_credit_applied_cents as number,
      card_refunded_to_card_cents: 0,
      card_credited_to_wallet_cents: 0,
      credit_refunded_cents: 0,
    });
    expect(remaining.remainingPaidCents).toBe(8000);
    expect(remaining.cardPaidCents).toBe(4800);
    expect(remaining.creditPaidCents).toBe(3200);
  });
});
