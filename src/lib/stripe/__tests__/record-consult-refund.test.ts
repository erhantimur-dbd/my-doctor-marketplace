import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STRIPE_REFUND_BOOKING_NOT_UPDATED } from "@/lib/booking/booking-row-update";
import { log } from "@/lib/utils/logger";
import {
  consultRefundLedgerKeys,
  recordConsultRefundOnBooking,
  type ConsultRefundBookingWriter,
  type RecordedConsultRefund,
} from "@/lib/stripe/record-consult-refund";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const rel = join(dir, name);
    if (statSync(rel).isDirectory()) {
      if (name === "node_modules" || name === ".git") continue;
      out.push(...walk(rel));
    } else if (rel.endsWith(".ts") || rel.endsWith(".tsx")) {
      out.push(rel);
    }
  }
  return out;
}

const BOOKING_ID = "11111111-1111-1111-1111-111111111111";

function paidBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: BOOKING_ID,
    total_amount_cents: 4000,
    wallet_credit_applied_cents: 0,
    refund_amount_cents: 0,
    rescheduled_from_booking_id: null,
    reschedule_price_diff_cents: null,
    reschedule_payment_status: null,
    card_refunded_to_card_cents: 0,
    card_credited_to_wallet_cents: 0,
    credit_refunded_cents: 0,
    paid_at: "2026-09-26T12:00:00.000Z",
    status: "confirmed",
    ...overrides,
  };
}

function memoryWriter(initial: Record<string, unknown>) {
  const claims = new Set<string>();
  let row = { ...initial };
  let failUpdates = 0;
  let updates = 0;
  const writer: ConsultRefundBookingWriter = {
    async claim(eventId) {
      if (claims.has(eventId)) return "duplicate";
      claims.add(eventId);
      return "claimed";
    },
    async release(eventId) {
      claims.delete(eventId);
    },
    async updateBooking(_bookingId, patch) {
      updates += 1;
      if (failUpdates > 0) {
        failUpdates -= 1;
        return { error: null, rows: [] };
      }
      row = { ...row, ...patch };
      return { error: null, rows: [{ id: String(row.id) }] };
    },
  };
  return {
    writer,
    claims,
    updates: () => updates,
    row: () => row,
    failNext(n: number) {
      failUpdates = n;
    },
  };
}

function cardRefund(
  cents: number,
  refundId: string,
  overrides: Partial<RecordedConsultRefund> = {}
): RecordedConsultRefund {
  return {
    cardRefundedToCardCents: cents,
    creditRefundCents: 0,
    walletCreditCents: 0,
    alreadyApplied: false,
    cardRefundId: refundId,
    cardRefundCents: cents,
    ...overrides,
  };
}

describe("recordConsultRefundOnBooking balance row", () => {
  const originalId = "22222222-2222-2222-2222-222222222222";

  function balanceBooking(overrides: Record<string, unknown> = {}) {
    return paidBooking({
      booking_number: "BK-20260926-1126",
      total_amount_cents: 5000,
      reschedule_price_diff_cents: 1000,
      reschedule_payment_status: "paid",
      rescheduled_from_booking_id: originalId,
      stripe_charge_id: "ch_3UK31MPhJvj3ftQe19YquLhR",
      ...overrides,
    });
  }

  it("sets refunded_at when the £10 balance charge is fully refunded, not the £50 fee", async () => {
    const booking = balanceBooking();
    const mem = memoryWriter(booking);

    const partial = await recordConsultRefundOnBooking(
      {
        bookingId: BOOKING_ID,
        booking,
        settled: cardRefund(400, "re_balance_partial"),
        markStatusRefunded: true,
      },
      { writer: mem.writer }
    );
    expect("error" in partial).toBe(false);
    expect(mem.row()).toMatchObject({
      card_refunded_to_card_cents: 400,
      refund_amount_cents: 400,
    });
    expect(mem.row()).not.toHaveProperty("refunded_at");
    expect(mem.row().status).toBe("confirmed");

    const afterPartial = { ...booking, ...mem.row() };
    const rest = await recordConsultRefundOnBooking(
      {
        bookingId: BOOKING_ID,
        booking: afterPartial,
        settled: cardRefund(600, "re_balance_rest"),
        markStatusRefunded: true,
      },
      { writer: mem.writer }
    );
    expect("error" in rest).toBe(false);
    expect(mem.row()).toMatchObject({
      card_refunded_to_card_cents: 1000,
      refund_amount_cents: 1000,
      status: "refunded",
    });
    expect(mem.row().refunded_at).toEqual(expect.any(String));
  });

  it("marks a single full refund of the balance charge refunded", async () => {
    const booking = balanceBooking();
    const mem = memoryWriter(booking);

    const recorded = await recordConsultRefundOnBooking(
      {
        bookingId: BOOKING_ID,
        booking,
        settled: cardRefund(1000, "re_balance_full"),
      },
      { writer: mem.writer }
    );
    expect("error" in recorded).toBe(false);
    expect(mem.row()).toMatchObject({
      card_refunded_to_card_cents: 1000,
      refund_amount_cents: 1000,
    });
    expect(mem.row().refunded_at).toEqual(expect.any(String));
    expect(mem.row().status).toBe("confirmed");
  });
});

describe("recordConsultRefundOnBooking", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("increments card, wallet, and credit counters and marks a full refund", async () => {
    const booking = paidBooking({
      total_amount_cents: 10000,
      wallet_credit_applied_cents: 4000,
    });
    const mem = memoryWriter(booking);

    const partial = await recordConsultRefundOnBooking(
      {
        bookingId: BOOKING_ID,
        booking,
        settled: {
          cardRefundedToCardCents: 1500,
          creditRefundCents: 1000,
          walletCreditCents: 1000,
          alreadyApplied: false,
          cardRefundId: "re_partial",
          cardRefundCents: 1500,
        },
        markStatusRefunded: true,
      },
      { writer: mem.writer }
    );

    expect("error" in partial).toBe(false);
    expect(mem.row()).toMatchObject({
      card_refunded_to_card_cents: 1500,
      card_credited_to_wallet_cents: 0,
      credit_refunded_cents: 1000,
      refund_amount_cents: 2500,
    });
    expect(mem.row()).not.toHaveProperty("refunded_at");
    expect(mem.row().status).toBe("confirmed");

    const afterPartial = { ...booking, ...mem.row() };
    const rest = await recordConsultRefundOnBooking(
      {
        bookingId: BOOKING_ID,
        booking: afterPartial,
        settled: {
          cardRefundedToCardCents: 4500,
          creditRefundCents: 3000,
          walletCreditCents: 3000,
          alreadyApplied: false,
          cardRefundId: "re_rest",
          cardRefundCents: 4500,
        },
        markStatusRefunded: true,
      },
      { writer: mem.writer }
    );

    expect("error" in rest).toBe(false);
    expect(mem.row()).toMatchObject({
      card_refunded_to_card_cents: 6000,
      card_credited_to_wallet_cents: 0,
      credit_refunded_cents: 4000,
      refund_amount_cents: 10000,
      status: "refunded",
    });
    expect(mem.row().refunded_at).toEqual(expect.any(String));
  });

  it("does not add the same Stripe refund id twice when the booking row is already fresh", async () => {
    const booking = paidBooking();
    const mem = memoryWriter(booking);
    const settled = cardRefund(1500, "re_1500");

    await recordConsultRefundOnBooking(
      { bookingId: BOOKING_ID, booking, settled, markStatusRefunded: true },
      { writer: mem.writer }
    );
    const fresh = { ...booking, ...mem.row() };
    const again = await recordConsultRefundOnBooking(
      {
        bookingId: BOOKING_ID,
        booking: fresh,
        settled,
        markStatusRefunded: true,
      },
      { writer: mem.writer }
    );

    expect(again).toMatchObject({ alreadyRecorded: true, patch: null });
    expect(mem.row().card_refunded_to_card_cents).toBe(1500);
    expect(mem.updates()).toBe(1);
  });

  it("restores an applied offset once per refund id", async () => {
    const booking = paidBooking({ total_amount_cents: 10000 });
    const mem = memoryWriter(booking);
    const restored: {
      bookingId: string;
      refundId: string;
      refundCents: number;
      originalPaidCents: number;
    }[] = [];
    const deps = {
      writer: mem.writer,
      restoreOffset: async (input: (typeof restored)[number]) => {
        restored.push(input);
        return 500;
      },
    };
    const settled = cardRefund(5000, "re_offset");
    await recordConsultRefundOnBooking(
      { bookingId: BOOKING_ID, booking, settled },
      deps
    );
    expect(restored).toEqual([
      {
        bookingId: BOOKING_ID,
        refundId: "re_offset",
        refundCents: 5000,
        originalPaidCents: 10000,
      },
    ]);
    const fresh = { ...booking, ...mem.row() };
    await recordConsultRefundOnBooking(
      { bookingId: BOOKING_ID, booking: fresh, settled },
      deps
    );
    expect(restored).toHaveLength(1);
  });

  it("treats a wallet retry that dropped the Stripe refund id as the same refund", async () => {
    const booking = paidBooking({
      total_amount_cents: 6000,
      wallet_credit_applied_cents: 0,
    });
    const mem = memoryWriter(booking);
    const firstSettled = cardRefund(0, "re_wallet_card", {
      cardRefundedToCardCents: 0,
      walletCreditCents: 6000,
      cardRefundCents: 6000,
    });
    await recordConsultRefundOnBooking(
      { bookingId: BOOKING_ID, booking, settled: firstSettled },
      { writer: mem.writer }
    );

    const retry = await recordConsultRefundOnBooking(
      {
        bookingId: BOOKING_ID,
        booking,
        settled: {
          ...firstSettled,
          cardRefundId: null,
          alreadyApplied: true,
        },
      },
      { writer: mem.writer }
    );

    expect(retry).toMatchObject({ alreadyRecorded: true });
    expect(mem.row()).toMatchObject({
      card_refunded_to_card_cents: 0,
      card_credited_to_wallet_cents: 6000,
      credit_refunded_cents: 0,
      refund_amount_cents: 6000,
    });
    expect(mem.updates()).toBe(1);
  });

  it("releases the ledger claim when the booking update throws", async () => {
    vi.spyOn(log, "error").mockImplementation(() => {});
    const booking = paidBooking();
    const mem = memoryWriter(booking);
    const settled = cardRefund(1500, "re_throw");
    mem.writer.updateBooking = async () => {
      throw new Error("connection reset");
    };

    const failed = await recordConsultRefundOnBooking(
      { bookingId: BOOKING_ID, booking, settled, markStatusRefunded: true },
      { writer: mem.writer }
    );
    expect(failed).toEqual({ error: STRIPE_REFUND_BOOKING_NOT_UPDATED });
    expect(mem.claims.size).toBe(0);
  });

  it("releases the ledger claim when zero rows update so a retry can record", async () => {
    vi.spyOn(log, "error").mockImplementation(() => {});
    const booking = paidBooking();
    const mem = memoryWriter(booking);
    mem.failNext(1);
    const settled = cardRefund(4000, "re_full");

    const failed = await recordConsultRefundOnBooking(
      { bookingId: BOOKING_ID, booking, settled, markStatusRefunded: true },
      { writer: mem.writer }
    );
    expect(failed).toEqual({ error: STRIPE_REFUND_BOOKING_NOT_UPDATED });
    expect(mem.claims.size).toBe(0);

    const retried = await recordConsultRefundOnBooking(
      { bookingId: BOOKING_ID, booking, settled, markStatusRefunded: true },
      { writer: mem.writer }
    );
    expect("error" in retried).toBe(false);
    expect(mem.row()).toMatchObject({
      card_refunded_to_card_cents: 4000,
      refund_amount_cents: 4000,
      status: "refunded",
    });
  });

  it("keeps a cancel status while still setting refunded_at on a full refund", async () => {
    const booking = paidBooking();
    const mem = memoryWriter(booking);
    const recorded = await recordConsultRefundOnBooking(
      {
        bookingId: BOOKING_ID,
        booking,
        settled: cardRefund(4000, "re_cancel"),
        extra: {
          status: "cancelled_patient",
          cancellation_reason: "Changed my mind",
        },
      },
      { writer: mem.writer }
    );
    expect("error" in recorded).toBe(false);
    expect(mem.row()).toMatchObject({
      status: "cancelled_patient",
      cancellation_reason: "Changed my mind",
      card_refunded_to_card_cents: 4000,
      refund_amount_cents: 4000,
    });
    expect(mem.row().refunded_at).toEqual(expect.any(String));
  });

  it("writes a cheaper-reschedule rebase once per Stripe refund id", async () => {
    const booking = paidBooking({ total_amount_cents: 10000 });
    const mem = memoryWriter(booking);
    const settled = cardRefund(2000, "re_rebase");
    const input = {
      bookingId: BOOKING_ID,
      booking,
      settled,
      patchOverride: {
        total_amount_cents: 8000,
        wallet_credit_applied_cents: 0,
        card_refunded_to_card_cents: 0,
        card_credited_to_wallet_cents: 0,
        credit_refunded_cents: 0,
        refund_amount_cents: 2000,
      },
      extra: { doctor_id: "doc-2", total_amount_cents: 8000 },
    };

    await recordConsultRefundOnBooking(input, { writer: mem.writer });
    const again = await recordConsultRefundOnBooking(
      { ...input, booking: { ...booking, ...mem.row() } },
      { writer: mem.writer }
    );

    expect(again).toMatchObject({ alreadyRecorded: true });
    expect(mem.row()).toMatchObject({
      card_refunded_to_card_cents: 0,
      refund_amount_cents: 2000,
      total_amount_cents: 8000,
      doctor_id: "doc-2",
    });
    expect(mem.updates()).toBe(1);
  });

  it("keys the ledger on the Stripe refund id and the amount shape", () => {
    expect(
      consultRefundLedgerKeys({
        stripeRefundId: "re_abc",
        bookingId: BOOKING_ID,
        alreadyRefundedCents: 0,
        cardRefundedToCardCents: 1500,
        walletCreditCents: 0,
        creditRefundCents: 0,
      })[0]
    ).toBe("consult-refund:re_abc");
  });
});

describe("every consult refund path records through the helper", () => {
  const booking = read("src/actions/booking.ts");
  const cancel = booking.slice(
    booking.indexOf("export async function cancelBooking"),
    booking.indexOf("export async function cancelAndRebook")
  );
  const rebook = booking.slice(
    booking.indexOf("export async function cancelAndRebook"),
    booking.indexOf("export async function getBookingDetails")
  );
  const admin = read("src/actions/admin.ts");
  const adminRefund = admin.slice(
    admin.indexOf("export async function adminRefundBooking"),
    admin.indexOf("export async function adminUpdateBookingStatus")
  );
  const adminCancel = admin.slice(
    admin.indexOf("export async function adminCancelBooking"),
    admin.indexOf("export async function adminGetCancelPreview")
  );
  const clinic = read("src/actions/clinic-booking.ts");
  const clinicCancel = clinic.slice(
    clinic.indexOf("export async function adminCancelBooking"),
    clinic.indexOf("export async function adminRescheduleBooking")
  );
  const clinicReschedule = clinic.slice(
    clinic.indexOf("export async function adminRescheduleBooking")
  );
  const gp = read("src/lib/gp/reassign.ts");
  const noReplacement = gp.slice(
    gp.indexOf("export async function executeGpReassignmentRequest"),
    gp.indexOf("export async function acceptGpSlotOffer")
  );
  const decline = gp.slice(
    gp.indexOf("export async function declineAllGpOffers"),
    gp.indexOf("export async function expireGpOffersAndRefund")
  );
  const expire = gp.slice(
    gp.indexOf("export async function expireGpOffersAndRefund")
  );

  it("admin refund sets status refunded through the helper", () => {
    expect(adminRefund).toContain("recordConsultRefundOnBooking");
    expect(adminRefund).toContain("markStatusRefunded: true");
    expect(adminRefund).not.toContain("bookingRefundSettlementPatch");
  });

  it("admin cancel keeps cancelled_doctor and records the refund", () => {
    expect(adminCancel).toContain("recordConsultRefundOnBooking");
    expect(adminCancel).toContain("BOOKING_STATUSES.CANCELLED_DOCTOR");
    expect(adminCancel).not.toContain("bookingRefundSettlementPatch");
  });

  it("patient cancel and cancel-and-rebook record through the helper", () => {
    expect(cancel).toContain("recordConsultRefundOnBooking");
    expect(cancel).toContain("BOOKING_STATUSES.CANCELLED_PATIENT");
    expect(cancel).not.toMatch(/from\("bookings"\)\s*\.update/);
    expect(rebook).toContain('destination: "wallet"');
    expect(rebook).toContain("recordConsultRefundOnBooking");
    expect(rebook).toContain("BOOKING_STATUSES.CANCELLED_PATIENT");
    expect(rebook).not.toMatch(/from\("bookings"\)\s*\.update/);
  });

  it("clinic cancel and cheaper reschedule record through the helper", () => {
    expect(clinicCancel).toContain("refundClinicCancellation");
    expect(clinicCancel).toContain("recordConsultRefundOnBooking");
    expect(clinicCancel).toContain('status: "cancelled_doctor"');
    expect(clinicReschedule).toContain("refundConsultSplit");
    expect(clinicReschedule).toContain("cheaperReschedulePaidRebasePatch");
    expect(clinicReschedule).toContain("patchOverride:");
    expect(clinicReschedule).toContain("recordConsultRefundOnBooking");
  });

  it("GP no-replacement, decline, and offer-expiry refunds record through the helper", () => {
    expect(gp).toContain("async function persistGpCancellation");
    expect(gp).toContain("recordConsultRefundOnBooking");
    expect(noReplacement).toContain("persistGpCancellation");
    expect(noReplacement).toContain('status: "cancelled_doctor"');
    expect(decline).toContain("persistGpCancellation");
    expect(decline).toContain('gp_reassignment_status: "patient_declined"');
    expect(expire).toContain("persistGpCancellation");
    expect(expire).toContain(
      "Alternate GP offers expired without response"
    );
    expect(read("src/app/api/cron/gp-offer-expiry/route.ts")).toContain(
      "expireGpOffersAndRefund"
    );
  });

  it("a doctor status change does not refund, and the webhook does not write counters", () => {
    const doctor = read("src/actions/doctor.ts");
    const status = doctor.slice(
      doctor.indexOf("export async function updateBookingStatus"),
      doctor.indexOf("export async function connectStripeAccount")
    );
    expect(status).not.toContain("recordConsultRefundOnBooking");
    expect(status).not.toContain("refundConsultSplit");

    const webhook = read("src/app/api/webhooks/stripe/route.ts");
    expect(webhook).not.toContain('from "@/lib/stripe/record-consult-refund"');
    expect(webhook).not.toContain("card_refunded_to_card_cents");
    expect(webhook).toContain("charge.refunded");
  });

  it("stripe.refunds.create exists only in the card-share helper", () => {
    const hits = walk(join(process.cwd(), "src"))
      .map((file) => file.slice(join(process.cwd()).length + 1))
      .filter(
        (rel) =>
          !rel.includes(`${join("src", "__tests__")}`) &&
          !rel.includes("/__tests__/") &&
          read(rel).includes("await stripe.refunds.create(")
      );
    expect(hits).toEqual(["src/lib/stripe/wallet-credit-share.ts"]);
  });
});
