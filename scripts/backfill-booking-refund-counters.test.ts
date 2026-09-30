import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  recordConsultRefundOnBooking,
  type ConsultRefundBookingWriter,
} from "@/lib/stripe/record-consult-refund";
import {
  bstStampToUtcIso,
  loadRefundBackfillTable,
  parseBackfillArgs,
  runBookingRefundCounterBackfill,
  type BackfillIo,
  type BookingSnapshot,
  type RefundBackfillRow,
} from "./backfill-booking-refund-counters";

vi.mock("@/lib/stripe/record-consult-refund", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/stripe/record-consult-refund")>();
  return {
    ...actual,
    recordConsultRefundOnBooking: vi.fn(actual.recordConsultRefundOnBooking),
  };
});

const PROJECT_URL = "https://abcdefghijklmnop.supabase.co";
const CARRY_OVER_ID = "c1616576-0000-4000-8000-000000000000";

function table(): RefundBackfillRow[] {
  return loadRefundBackfillTable();
}

function bookingFor(
  row: RefundBackfillRow,
  overrides: Partial<BookingSnapshot> = {}
): BookingSnapshot {
  const balance = row.leg === "balance";
  return {
    id: row.booking_id,
    booking_number: row.ref,
    status: balance ? "refunded" : "cancelled_doctor",
    payment_mode: "full",
    total_amount_cents: balance ? 5000 : row.refund_amount_cents,
    deposit_amount_cents: null,
    wallet_credit_applied_cents: 0,
    rescheduled_from_booking_id: balance ? "11111111-1111-4111-8111-111111111111" : null,
    reschedule_price_diff_cents: balance ? row.refund_amount_cents : null,
    reschedule_payment_status: balance ? "paid" : null,
    refund_amount_cents: row.refund_amount_cents,
    refunded_at: "2026-09-26T21:20:40.000Z",
    card_refunded_to_card_cents: 0,
    card_credited_to_wallet_cents: 0,
    credit_refunded_cents: 0,
    stripe_payment_intent_id: row.payment_intent,
    stripe_charge_id: null,
    stripe_destination_transfer_id: null,
    destination_transfer_reversed_cents: null,
    destination_transfer_reversed_at: null,
    destination_transfer_reversal_reconciled_at: null,
    ...overrides,
  };
}

function memoryWriter(initial: BookingSnapshot[]) {
  const claims = new Set<string>();
  const rows = new Map(initial.map((row) => [row.id, { ...row }]));
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
    async updateBooking(bookingId, patch) {
      updates += 1;
      const row = rows.get(bookingId);
      if (!row) return { error: { message: "missing" }, rows: [] };
      rows.set(bookingId, { ...row, ...patch } as BookingSnapshot);
      return { error: null, rows: [{ id: bookingId }] };
    },
  };
  return {
    writer,
    updates: () => updates,
    row: (id: string) => rows.get(id),
  };
}

async function run(input: {
  apply?: boolean;
  allowLive?: boolean;
  stripeSecretKey?: string;
  rows?: RefundBackfillRow[];
  bookings?: BookingSnapshot[];
  bookingIds?: string[];
  writer?: ConsultRefundBookingWriter;
  loadBookings?: BackfillIo["loadBookings"];
}) {
  const lines: string[] = [];
  const rows = input.rows ?? table().slice(0, 2);
  const bookings = input.bookings ?? rows.filter((row) => row.refund).map((row) => bookingFor(row));
  const summary = await runBookingRefundCounterBackfill({
    apply: input.apply ?? false,
    allowLive: input.allowLive ?? true,
    stripeSecretKey: input.stripeSecretKey,
    supabaseUrl: PROJECT_URL,
    rows,
    bookingIds: input.bookingIds,
    io: { loadBookings: input.loadBookings ?? (async () => bookings) },
    writer: input.writer,
    log: (line) => lines.push(line),
  });
  return { summary, lines };
}

describe("refund backfill table", () => {
  it("has the 16 Stripe-matched rows and leaves the carry-over booking out", () => {
    const rows = table();
    expect(rows).toHaveLength(16);
    expect(rows.filter((row) => row.leg === "original" && row.refund_amount_cents === 4000)).toHaveLength(8);
    expect(rows.filter((row) => row.leg === "balance" && row.refund_amount_cents === 1000)).toHaveLength(8);
    const raw = readFileSync(
      join(process.cwd(), "scripts/data/refund-backfill-2026-09-30.json"),
      "utf8"
    );
    expect(raw).not.toContain("BK-20260926-8BE0");
    expect(raw).not.toContain(CARRY_OVER_ID);
    expect(raw).not.toContain("c1616576");
  });

  it("converts the first BST stamps to UTC", () => {
    expect(bstStampToUtcIso("26 Sep 22:20:40 BST", 2026)).toBe(
      "2026-09-26T21:20:40.000Z"
    );
    expect(bstStampToUtcIso("26 Sep 22:20:42 BST", 2026)).toBe(
      "2026-09-26T21:20:42.000Z"
    );
  });
});

describe("runBookingRefundCounterBackfill", () => {
  beforeEach(() => {
    vi.mocked(recordConsultRefundOnBooking).mockClear();
  });

  it("dry-run prints a before/after diff and writes nothing", async () => {
    const rows = table().slice(0, 2);
    const { summary, lines } = await run({ rows });
    expect(summary.apply).toBe(false);
    expect(summary.wouldUpdate).toBe(2);
    expect(summary.updated).toBe(0);
    expect(summary.supabaseProjectRef).toBe("abcdefghijklmnop");
    expect(recordConsultRefundOnBooking).not.toHaveBeenCalled();
    expect(lines.join("\n")).toContain(
      "card_refunded_to_card_cents: 0 -> 4000"
    );
    expect(lines.join("\n")).toContain(
      "card_refunded_to_card_cents: 0 -> 1000"
    );
    expect(lines.join("\n")).toContain("refunded_at: 2026-09-26T21:20:40.000Z (unchanged)");
    expect(lines.join("\n")).toContain("status: cancelled_doctor (unchanged)");
    expect(lines.join("\n")).toContain("status: refunded (unchanged)");
    expect(lines.join("\n")).toContain(
      "summary mode=dry-run stripe=not used supabase=abcdefghijklmnop scanned=2 would-update=2 skipped=0 already-claimed=0"
    );
    expect(lines.join("\n")).toContain("stripe_charge_id: null -> ch_3UK31LPhJvj3ftQe0hz1JiDw");
    expect(lines.join("\n")).toContain(
      "destination_transfer_reversed_at: null -> 2026-09-26T21:20:40.000Z"
    );
  });

  it("apply writes table counters and null stripe columns through the capped helper", async () => {
    const rows = table().slice(0, 2);
    const bookings = rows.map((row) => bookingFor(row));
    const mem = memoryWriter(bookings);
    const { summary } = await run({
      apply: true,
      rows,
      bookings,
      writer: mem.writer,
    });

    expect(summary.updated).toBe(2);
    expect(summary.skipped).toEqual([]);
    expect(recordConsultRefundOnBooking).toHaveBeenCalledTimes(2);
    for (const call of vi.mocked(recordConsultRefundOnBooking).mock.calls) {
      expect(call[0]).not.toHaveProperty("patchOverride");
      expect(Object.keys(call[0].booking)).toEqual(
        expect.arrayContaining([
          "rescheduled_from_booking_id",
          "reschedule_price_diff_cents",
          "reschedule_payment_status",
        ])
      );
    }

    const original = mem.row(rows[0].booking_id);
    expect(original).toMatchObject({
      status: "cancelled_doctor",
      refunded_at: "2026-09-26T21:20:40.000Z",
      card_refunded_to_card_cents: 4000,
      card_credited_to_wallet_cents: 0,
      credit_refunded_cents: 0,
      refund_amount_cents: 4000,
      stripe_charge_id: rows[0].charge,
      stripe_destination_transfer_id: rows[0].transfer,
      destination_transfer_reversed_cents: 4000,
      destination_transfer_reversed_at: "2026-09-26T21:20:40.000Z",
      destination_transfer_reversal_reconciled_at: "2026-09-26T21:20:40.000Z",
    });

    const balanceCall = vi.mocked(recordConsultRefundOnBooking).mock.calls[1]?.[0];
    expect(balanceCall?.booking).toMatchObject({
      total_amount_cents: 5000,
      reschedule_price_diff_cents: 1000,
      reschedule_payment_status: "paid",
    });
    expect(balanceCall?.settled).toMatchObject({
      cardRefundedToCardCents: 1000,
      creditRefundCents: 0,
      walletCreditCents: 0,
    });
    const balance = mem.row(rows[1].booking_id);
    expect(balance).toMatchObject({
      status: "refunded",
      refunded_at: "2026-09-26T21:20:40.000Z",
      card_refunded_to_card_cents: 1000,
      card_credited_to_wallet_cents: 0,
      credit_refunded_cents: 0,
      refund_amount_cents: 1000,
      stripe_charge_id: rows[1].charge,
      stripe_destination_transfer_id: rows[1].transfer,
      destination_transfer_reversed_cents: 1000,
    });
    expect(balance?.card_refunded_to_card_cents).not.toBe(5000);
  });

  it("skips a null refund and does not touch the carry-over booking", async () => {
    const carry: RefundBackfillRow = {
      ref: "BK-20260926-8BE0",
      booking_id: CARRY_OVER_ID,
      leg: "original",
      payment_intent: "pi_carry",
      charge: "ch_carry",
      transfer: "tr_carry",
      refund: null,
      refund_amount_cents: null,
      refund_succeeded_bst: null,
      transfer_reversal: null,
      transfer_reversed_cents: null,
    };
    const loadBookings = vi.fn(async () => []);
    const { summary, lines } = await run({
      rows: [carry],
      loadBookings,
    });
    expect(loadBookings).toHaveBeenCalledWith([]);
    expect(recordConsultRefundOnBooking).not.toHaveBeenCalled();
    expect(summary.wouldUpdate).toBe(0);
    expect(summary.skipped[0]?.reason).toContain("not refunded");
    expect(lines.join("\n")).toContain("BK-20260926-8BE0");
  });

  it("skips a charge or refund-amount mismatch", async () => {
    const row = table()[0];
    const charge = bookingFor(row, { stripe_charge_id: "ch_other" });
    const amount = bookingFor(row, { refund_amount_cents: 1 });
    const chargeRun = await run({ rows: [row], bookings: [charge] });
    expect(chargeRun.summary.wouldUpdate).toBe(0);
    expect(chargeRun.summary.skipped[0]?.reason).toContain("stripe_charge_id");
    expect(recordConsultRefundOnBooking).not.toHaveBeenCalled();

    const amountRun = await run({ rows: [row], bookings: [amount] });
    expect(amountRun.summary.skipped[0]?.reason).toContain("refund_amount_cents");
    expect(recordConsultRefundOnBooking).not.toHaveBeenCalled();
  });

  it("skips a balance row whose reschedule fields are null instead of using 5000", async () => {
    const row = table().find((item) => item.leg === "balance");
    if (!row) throw new Error("missing balance row");
    const narrow = bookingFor(row, {
      rescheduled_from_booking_id: null,
      reschedule_price_diff_cents: null,
      reschedule_payment_status: null,
      total_amount_cents: 5000,
    });
    const mem = memoryWriter([narrow]);
    const { summary } = await run({
      apply: true,
      rows: [row],
      bookings: [narrow],
      writer: mem.writer,
    });
    expect(summary.updated).toBe(0);
    expect(summary.skipped[0]?.reason).toContain("total_amount_cents 5000");
    expect(mem.updates()).toBe(0);
    expect(recordConsultRefundOnBooking).not.toHaveBeenCalled();
  });

  it("stops when the reschedule fields are missing from the loaded row", async () => {
    const row = table().find((item) => item.leg === "balance");
    if (!row) throw new Error("missing balance row");
    const full = bookingFor(row);
    const missing: Partial<BookingSnapshot> = { ...full };
    delete missing.rescheduled_from_booking_id;
    delete missing.reschedule_price_diff_cents;
    delete missing.reschedule_payment_status;
    const mem = memoryWriter([full]);
    const { summary } = await run({
      apply: true,
      rows: [row],
      loadBookings: async () => [missing as BookingSnapshot],
      writer: mem.writer,
    });
    expect(summary.stoppedOnError).toContain("reschedule_price_diff_cents");
    expect(summary.updated).toBe(0);
    expect(mem.updates()).toBe(0);
  });

  it("a second apply is a no-op when the refund id is already claimed", async () => {
    const row = table()[0];
    const loaded = bookingFor(row);
    const mem = memoryWriter([loaded]);
    const first = await run({
      apply: true,
      rows: [row],
      bookings: [loaded],
      writer: mem.writer,
    });
    expect(first.summary.updated).toBe(1);
    expect(mem.row(row.booking_id)?.card_refunded_to_card_cents).toBe(4000);

    const second = await run({
      apply: true,
      rows: [row],
      bookings: [loaded],
      writer: mem.writer,
    });
    expect(second.summary.alreadyClaimed).toBe(1);
    expect(second.summary.updated).toBe(0);
    expect(mem.row(row.booking_id)?.card_refunded_to_card_cents).toBe(4000);
    expect(mem.updates()).toBe(1);
  });

  it("refuses a live Stripe key before loading bookings", async () => {
    const loadBookings = vi.fn(async () => []);
    await expect(
      run({
        stripeSecretKey: "sk_live_backfill",
        allowLive: false,
        loadBookings,
      })
    ).rejects.toThrow(/live/);
    await expect(
      run({
        stripeSecretKey: "rk_live_backfill",
        allowLive: false,
        loadBookings,
      })
    ).rejects.toThrow(/live/);
    expect(loadBookings).not.toHaveBeenCalled();
    expect(recordConsultRefundOnBooking).not.toHaveBeenCalled();
  });

  it("does not overwrite a charge id that already matches", async () => {
    const row = table()[0];
    const loaded = bookingFor(row, {
      stripe_charge_id: row.charge,
      stripe_destination_transfer_id: row.transfer,
      destination_transfer_reversed_cents: 4000,
      destination_transfer_reversed_at: "2026-09-26T21:20:40.000Z",
    });
    const { lines, summary } = await run({ rows: [row], bookings: [loaded] });
    expect(summary.wouldUpdate).toBe(1);
    const text = lines.join("\n");
    expect(text).toContain(`stripe_charge_id: ${row.charge} (unchanged)`);
    expect(text).toContain(
      `stripe_destination_transfer_id: ${row.transfer} (unchanged)`
    );
    expect(text).toContain("destination_transfer_reversed_cents: 4000 (unchanged)");
    expect(text).toContain(
      "destination_transfer_reversal_reconciled_at: null -> 2026-09-26T21:20:40.000Z"
    );
  });
});

describe("backfill script source", () => {
  const source = readFileSync(
    join(process.cwd(), "scripts/backfill-booking-refund-counters.ts"),
    "utf8"
  );

  it("selects the reschedule columns and writes only through the helper", () => {
    expect(source).toContain("rescheduled_from_booking_id");
    expect(source).toContain("reschedule_price_diff_cents");
    expect(source).toContain("reschedule_payment_status");
    expect(source).toContain("recordConsultRefundOnBooking");
    expect(source).toContain("storedConsultPaidParts");
    expect(source).not.toContain("patchOverride");
    expect(parseBackfillArgs([]).apply).toBe(false);
  });
});
