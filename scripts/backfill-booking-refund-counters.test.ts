import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STRIPE_REFUND_BOOKING_NOT_UPDATED } from "@/lib/booking/booking-row-update";
import {
  recordConsultRefundOnBooking,
  type ConsultRefundBookingWriter,
} from "@/lib/stripe/record-consult-refund";
import {
  BACKFILL_SELECTION_OR,
  listCandidateBookings,
  parseBackfillArgs,
  runBookingRefundCounterBackfill,
  type BackfillBookingDb,
  type BackfillIo,
  type CandidateBooking,
  type RefundSnapshot,
} from "./backfill-booking-refund-counters";

vi.mock("@/lib/stripe/record-consult-refund", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/stripe/record-consult-refund")>();
  return {
    ...actual,
    recordConsultRefundOnBooking: vi.fn(actual.recordConsultRefundOnBooking),
  };
});

const BOOKING_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_URL = "https://abcdefghijklmnop.supabase.co";
const TEST_KEY = "sk_test_backfill";

function booking(overrides: Partial<CandidateBooking> = {}): CandidateBooking {
  return {
    id: BOOKING_ID,
    booking_number: "BK-20260901-TEST",
    status: "cancelled_patient",
    currency: "gbp",
    paid_at: "2026-09-01T12:00:00.000Z",
    cancelled_at: "2026-09-02T12:00:00.000Z",
    refunded_at: null,
    cancellation_reason: "Changed my mind",
    stripe_payment_intent_id: "pi_test",
    stripe_charge_id: "ch_test",
    payment_mode: "full",
    total_amount_cents: 4000,
    deposit_amount_cents: null,
    wallet_credit_applied_cents: 0,
    refund_amount_cents: 0,
    card_refunded_to_card_cents: 0,
    card_credited_to_wallet_cents: 0,
    credit_refunded_cents: 0,
    ...overrides,
  };
}

function refund(overrides: Partial<RefundSnapshot> = {}): RefundSnapshot {
  return {
    id: "re_ok",
    amount: 4000,
    created: Date.parse("2026-09-02T13:00:00.000Z") / 1000,
    status: "succeeded",
    reverseTransfer: false,
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
    updates: () => updates,
    row: () => row,
    resetRow(next: Record<string, unknown>) {
      row = { ...next };
    },
    failNext(n: number) {
      failUpdates = n;
    },
  };
}

function io(overrides: Partial<BackfillIo> = {}): BackfillIo {
  return {
    listCandidates: async () => [booking()],
    listChargeRefunds: async () => [refund()],
    latestChargeId: async () => {
      throw new Error("latestChargeId should not be called");
    },
    ...overrides,
  };
}

function run(
  overrides: Partial<Parameters<typeof runBookingRefundCounterBackfill>[0]> & {
    log?: (line: string) => void;
  } = {}
) {
  const lines: string[] = [];
  const log = overrides.log ?? ((line: string) => lines.push(line));
  return runBookingRefundCounterBackfill({
    apply: false,
    allowLive: false,
    stripeSecretKey: TEST_KEY,
    supabaseUrl: PROJECT_URL,
    io: io(),
    log,
    ...overrides,
  }).then((summary) => ({ summary, lines }));
}

beforeEach(() => {
  vi.mocked(recordConsultRefundOnBooking).mockClear();
});

describe("parseBackfillArgs", () => {
  it("defaults to a dry run and parses booking ids", () => {
    expect(parseBackfillArgs([])).toEqual({
      help: false,
      apply: false,
      allowLive: false,
      bookingIds: undefined,
    });
    expect(
      parseBackfillArgs([
        "--apply",
        "--allow-live",
        "--booking-ids",
        " a , b,a ",
      ])
    ).toEqual({
      help: false,
      apply: true,
      allowLive: true,
      bookingIds: ["a", "b"],
    });
    expect(parseBackfillArgs(["--booking-ids=c"])).toMatchObject({
      bookingIds: ["c"],
    });
  });

  it("rejects unknown arguments and an empty id list", () => {
    expect(() => parseBackfillArgs(["--aply"])).toThrow(/Unknown argument/);
    expect(() => parseBackfillArgs(["--booking-ids"])).toThrow(/booking-ids/);
    expect(() => parseBackfillArgs(["--booking-ids", ","])).toThrow(/empty/);
  });
});

describe("booking refund counter backfill", () => {
  it("dry run writes nothing and prints the plan", async () => {
    const writer = memoryWriter(booking());
    writer.writer.claim = async () => {
      throw new Error("dry run claimed a refund");
    };
    writer.writer.updateBooking = async () => {
      throw new Error("dry run updated a booking");
    };
    const listed = vi.fn(async () => [
      refund({ id: "re_full", amount: 4000, reverseTransfer: true }),
    ]);
    const { summary, lines } = await run({
      apply: false,
      writer: writer.writer,
      io: io({ listChargeRefunds: listed }),
    });

    expect(recordConsultRefundOnBooking).not.toHaveBeenCalled();
    expect(listed).toHaveBeenCalledWith("ch_test");
    expect(summary.wouldUpdate).toBe(1);
    expect(summary.updated).toBe(0);
    expect(summary.plans[0]?.wouldWrite).toMatchObject({
      card_refunded_to_card_cents: 4000,
      card_credited_to_wallet_cents: 0,
      credit_refunded_cents: 0,
      refund_amount_cents: 4000,
      refundedAt: "set",
    });
    expect(lines[0]).toBe("stripe mode: test");
    expect(lines[1]).toBe("supabase project: abcdefghijklmnop");
    expect(lines.join("\n")).toContain(
      "booking 11111111-1111-4111-8111-111111111111 BK-20260901-TEST"
    );
    expect(lines.join("\n")).toContain(
      "current counters: card_refunded_to_card_cents=0 card_credited_to_wallet_cents=0 credit_refunded_cents=0 refund_amount_cents=0"
    );
    expect(lines.join("\n")).toContain(
      "re_full amount=4000 created=2026-09-02T13:00:00.000Z status=succeeded reverse_transfer=true include"
    );
    expect(lines.join("\n")).toContain(
      "would write re_full: card_refunded_to_card_cents=4000 card_credited_to_wallet_cents=0 credit_refunded_cents=0 refund_amount_cents=4000 refunded_at=set status=cancelled_patient (unchanged)"
    );
    expect(lines.join("\n")).toContain("would-update=1");
  });

  it("--apply calls the helper once per succeeded refund and keeps the cancelled status", async () => {
    const row = booking();
    const mem = memoryWriter(row);
    const { summary } = await run({
      apply: true,
      writer: mem.writer,
      io: io({
        listChargeRefunds: async () => [
          refund({
            id: "re_new",
            amount: 2500,
            created: 1_800_000_000,
            reverseTransfer: false,
          }),
          refund({
            id: "re_fail",
            amount: 900,
            created: 1_700_000_000,
            status: "failed",
          }),
          refund({
            id: "re_old",
            amount: 1500,
            created: 1_600_000_000,
            reverseTransfer: true,
          }),
          refund({
            id: "re_pend",
            amount: 800,
            created: 1_700_000_100,
            status: "pending",
          }),
        ],
      }),
    });

    const calls = vi.mocked(recordConsultRefundOnBooking).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[0]?.[0].settled).toMatchObject({
      cardRefundId: "re_old",
      cardRefundedToCardCents: 1500,
      creditRefundCents: 0,
      walletCreditCents: 0,
    });
    expect(calls[0]?.[0].markStatusRefunded).toBeUndefined();
    expect(calls[1]?.[0].settled).toMatchObject({
      cardRefundId: "re_new",
      cardRefundedToCardCents: 2500,
    });
    expect(calls[1]?.[0].booking).toMatchObject({
      card_refunded_to_card_cents: 1500,
      refund_amount_cents: 1500,
    });
    expect(calls.map((call) => call[0].settled?.cardRefundId)).not.toContain(
      "re_fail"
    );
    expect(mem.updates()).toBe(2);
    expect(mem.row()).toMatchObject({
      card_refunded_to_card_cents: 4000,
      card_credited_to_wallet_cents: 0,
      credit_refunded_cents: 0,
      refund_amount_cents: 4000,
      status: "cancelled_patient",
    });
    expect(mem.row().refunded_at).toEqual(expect.any(String));
    expect(summary.updated).toBe(1);
    expect(summary.wouldUpdate).toBe(0);
    expect(summary.plans[0]?.wouldWrite).toMatchObject({
      card_refunded_to_card_cents: 4000,
      refundedAt: "set",
    });
  });

  it("ignores failed and pending refunds", async () => {
    const mem = memoryWriter(booking({ total_amount_cents: 4000 }));
    const { summary } = await run({
      apply: true,
      writer: mem.writer,
      io: io({
        listChargeRefunds: async () => [
          refund({ id: "re_fail", amount: 4000, status: "failed" }),
          refund({ id: "re_pend", amount: 4000, status: "pending" }),
          refund({ id: "re_zero", amount: 0, status: "succeeded" }),
        ],
      }),
    });

    expect(recordConsultRefundOnBooking).not.toHaveBeenCalled();
    expect(mem.updates()).toBe(0);
    expect(summary.updated).toBe(0);
    expect(summary.skipped).toEqual([
      expect.objectContaining({
        id: BOOKING_ID,
        reason: expect.stringContaining("no succeeded Stripe refund"),
      }),
    ]);
    expect(summary.skipped[0]?.reason).toContain("re_fail failed");
    expect(summary.skipped[0]?.reason).toContain("re_pend pending");
    expect(summary.skipped[0]?.reason).toContain("out of scope");
  });

  it("keeps an already-claimed refund in the running total for the next refund", async () => {
    const row = booking();
    const mem = memoryWriter(row);
    await recordConsultRefundOnBooking(
      {
        bookingId: row.id,
        booking: row,
        settled: {
          cardRefundId: "re_old",
          cardRefundCents: 1500,
          cardRefundedToCardCents: 1500,
          creditRefundCents: 0,
          walletCreditCents: 0,
          alreadyApplied: false,
        },
      },
      { writer: mem.writer }
    );
    mem.resetRow(row);
    vi.mocked(recordConsultRefundOnBooking).mockClear();

    const { summary } = await run({
      apply: true,
      writer: mem.writer,
      io: io({
        listChargeRefunds: async () => [
          refund({ id: "re_old", amount: 1500, created: 100 }),
          refund({ id: "re_new", amount: 2500, created: 200 }),
        ],
      }),
    });

    const calls = vi.mocked(recordConsultRefundOnBooking).mock.calls;
    expect(summary.alreadyClaimed).toBe(1);
    expect(summary.updated).toBe(1);
    expect(calls[1]?.[0].booking).toMatchObject({
      card_refunded_to_card_cents: 1500,
    });
    expect(mem.row()).toMatchObject({
      card_refunded_to_card_cents: 4000,
      refund_amount_cents: 4000,
      status: "cancelled_patient",
    });
  });

  it("a re-run is a no-op because of the claims", async () => {
    const row = booking();
    const mem = memoryWriter(row);
    const candidates = async () => [
      booking({
        card_refunded_to_card_cents: 0,
        card_credited_to_wallet_cents: 0,
        credit_refunded_cents: 0,
        refund_amount_cents: 0,
      }),
    ];
    const backfillIo = io({
      listCandidates: candidates,
      listChargeRefunds: async () => [refund({ id: "re_once", amount: 4000 })],
    });

    const first = await run({ apply: true, writer: mem.writer, io: backfillIo });
    expect(first.summary.updated).toBe(1);
    expect(mem.updates()).toBe(1);
    expect(mem.row().card_refunded_to_card_cents).toBe(4000);

    vi.mocked(recordConsultRefundOnBooking).mockClear();
    const second = await run({ apply: true, writer: mem.writer, io: backfillIo });
    expect(recordConsultRefundOnBooking).toHaveBeenCalledTimes(1);
    expect(second.summary.updated).toBe(0);
    expect(second.summary.alreadyClaimed).toBe(1);
    expect(mem.updates()).toBe(1);
    expect(mem.row().card_refunded_to_card_cents).toBe(4000);
    expect(second.lines.join("\n")).toContain("already claimed: re_once");
  });

  it("skips a booking with no Stripe refunds", async () => {
    const listChargeRefunds = vi.fn(async () => []);
    const { summary } = await run({
      apply: true,
      io: io({ listChargeRefunds }),
    });

    expect(listChargeRefunds).toHaveBeenCalledOnce();
    expect(recordConsultRefundOnBooking).not.toHaveBeenCalled();
    expect(summary.updated).toBe(0);
    expect(summary.skipped[0]?.reason).toContain("no succeeded Stripe refund");
    expect(summary.plans[0]?.wouldWrite).toBeNull();
  });

  it("skips a booking with no charge and does not guess wallet credit", async () => {
    const listChargeRefunds = vi.fn(async () => [refund()]);
    const { summary, lines } = await run({
      apply: true,
      io: io({
        listCandidates: async () => [
          booking({
            stripe_charge_id: null,
            stripe_payment_intent_id: null,
            wallet_credit_applied_cents: 2500,
            total_amount_cents: 2500,
          }),
        ],
        listChargeRefunds,
      }),
    });

    expect(listChargeRefunds).not.toHaveBeenCalled();
    expect(recordConsultRefundOnBooking).not.toHaveBeenCalled();
    expect(summary.skipped[0]?.reason).toContain("no Stripe charge");
    expect(summary.skipped[0]?.reason).toContain("wallet_credit_applied_cents=2500");
    expect(lines.join("\n")).toContain("not guessed");
  });

  it("uses the payment intent latest charge when stripe_charge_id is empty", async () => {
    const latestChargeId = vi.fn(async () => "ch_from_pi");
    const listChargeRefunds = vi.fn(async () => [refund({ amount: 1500 })]);
    const mem = memoryWriter(booking({ total_amount_cents: 4000, stripe_charge_id: null }));
    const { summary } = await run({
      apply: true,
      writer: mem.writer,
      io: io({
        listCandidates: async () => [
          booking({ stripe_charge_id: "  ", stripe_payment_intent_id: "pi_only" }),
        ],
        latestChargeId,
        listChargeRefunds,
      }),
    });

    expect(latestChargeId).toHaveBeenCalledWith("pi_only");
    expect(listChargeRefunds).toHaveBeenCalledWith("ch_from_pi");
    expect(vi.mocked(recordConsultRefundOnBooking)).toHaveBeenCalledTimes(1);
    expect(summary.updated).toBe(1);
    expect(summary.plans[0]?.wouldWrite).toMatchObject({
      card_refunded_to_card_cents: 1500,
      refundedAt: "unchanged",
    });
    expect(mem.row().status).toBe("cancelled_patient");
    expect(mem.row().refunded_at).toBeNull();
  });

  it("reports wallet credit on a card refund without inventing the credit amount", async () => {
    const mem = memoryWriter(
      booking({
        total_amount_cents: 10000,
        wallet_credit_applied_cents: 4000,
      })
    );
    const { summary, lines } = await run({
      apply: true,
      writer: mem.writer,
      io: io({
        listCandidates: async () => [
          booking({
            total_amount_cents: 10000,
            wallet_credit_applied_cents: 4000,
          }),
        ],
        listChargeRefunds: async () => [refund({ amount: 6000 })],
      }),
    });

    expect(vi.mocked(recordConsultRefundOnBooking).mock.calls[0]?.[0].settled).toMatchObject({
      cardRefundedToCardCents: 6000,
      creditRefundCents: 0,
      walletCreditCents: 0,
    });
    expect(mem.row()).toMatchObject({
      card_refunded_to_card_cents: 6000,
      card_credited_to_wallet_cents: 0,
      credit_refunded_cents: 0,
      refund_amount_cents: 6000,
      status: "cancelled_patient",
    });
    expect(mem.row().refunded_at).toBeNull();
    expect(summary.plans[0]?.notes[0]).toContain("wallet_credit_applied_cents=4000");
    expect(lines.join("\n")).toContain("not guessed");
  });

  it("refuses a live Stripe key before reading bookings", async () => {
    const listCandidates = vi.fn(async () => [booking()]);
    const lines: string[] = [];
    await expect(
      run({
        stripeSecretKey: "sk_live_backfill",
        allowLive: false,
        log: (line) => lines.push(line),
        io: io({ listCandidates }),
      })
    ).rejects.toThrow(/live/);
    expect(listCandidates).not.toHaveBeenCalled();
    expect(recordConsultRefundOnBooking).not.toHaveBeenCalled();
    expect(lines).toEqual([
      "stripe mode: live",
      "supabase project: abcdefghijklmnop",
    ]);

    const allowed = await run({
      stripeSecretKey: "rk_live_restricted",
      allowLive: true,
      io: io({
        listCandidates: async () => [],
        listChargeRefunds: async () => [],
      }),
    });
    expect(allowed.summary.stripeMode).toBe("live");
    expect(allowed.summary.scanned).toBe(0);
  });

  it("stops on the first write error and does not move to the next booking", async () => {
    const first = booking({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", stripe_charge_id: "ch_a" });
    const second = booking({
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      stripe_charge_id: "ch_b",
      booking_number: "BK-B",
    });
    const mem = memoryWriter(first);
    mem.failNext(1);
    const seen: string[] = [];
    const { summary } = await run({
      apply: true,
      writer: mem.writer,
      io: io({
        listCandidates: async () => [first, second],
        listChargeRefunds: async (chargeId) => {
          seen.push(chargeId);
          return [refund()];
        },
      }),
    });

    expect(seen).toEqual(["ch_a"]);
    expect(summary.stoppedOnError).toBe(STRIPE_REFUND_BOOKING_NOT_UPDATED);
    expect(summary.updated).toBe(0);
    expect(summary.scanned).toBe(1);
  });

  it("passes --booking-ids through the same selection and reports ids that do not match", async () => {
    const listCandidates = vi.fn(async () => [booking()]);
    const { summary } = await run({
      bookingIds: [BOOKING_ID, "missing-id"],
      io: io({ listCandidates }),
    });
    expect(listCandidates).toHaveBeenCalledWith([BOOKING_ID, "missing-id"]);
    expect(summary.wouldUpdate).toBe(1);
    expect(summary.skipped).toEqual([
      {
        id: "missing-id",
        bookingNumber: null,
        reason: "not in the paid cancelled-or-refunded zero-counter selection",
      },
    ]);
  });
});

describe("listCandidateBookings", () => {
  it("uses the PR #80 zero-counter cancelled-or-refunded criteria", async () => {
    const calls: unknown[][] = [];
    const chain = {
      select(columns: string) {
        calls.push(["select", columns]);
        return chain;
      },
      not(column: string, operator: string, value: null) {
        calls.push(["not", column, operator, value]);
        return chain;
      },
      eq(column: string, value: number) {
        calls.push(["eq", column, value]);
        return chain;
      },
      or(filters: string) {
        calls.push(["or", filters]);
        return chain;
      },
      in(column: string, values: string[]) {
        calls.push(["in", column, values]);
        return chain;
      },
      order(column: string, options: { ascending: boolean }) {
        calls.push(["order", column, options]);
        return chain;
      },
      range() {
        calls.push(["range"]);
        return Promise.resolve({
          data: [
            booking({ id: "late", cancelled_at: "2026-09-03T00:00:00.000Z" }),
            booking({ id: "early", cancelled_at: "2026-09-01T00:00:00.000Z" }),
          ],
          error: null,
        });
      },
    };
    const db: BackfillBookingDb = {
      from(table) {
        calls.push(["from", table]);
        return chain;
      },
    };

    const rows = await listCandidateBookings(db, ["late"]);
    expect(rows.map((row) => row.id)).toEqual(["early", "late"]);
    expect(calls).toContainEqual(["from", "bookings"]);
    expect(calls).toContainEqual(["not", "paid_at", "is", null]);
    expect(calls).toContainEqual(["eq", "card_refunded_to_card_cents", 0]);
    expect(calls).toContainEqual(["eq", "card_credited_to_wallet_cents", 0]);
    expect(calls).toContainEqual(["eq", "credit_refunded_cents", 0]);
    expect(calls).toContainEqual(["or", BACKFILL_SELECTION_OR]);
    expect(BACKFILL_SELECTION_OR).toContain("cancelled_patient");
    expect(BACKFILL_SELECTION_OR).toContain("cancelled_doctor");
    expect(BACKFILL_SELECTION_OR).toContain("refunded");
    expect(BACKFILL_SELECTION_OR).toContain("refunded_at.not.is.null");
    expect(BACKFILL_SELECTION_OR).toContain("refund_amount_cents.gt.0");
    expect(calls).toContainEqual(["in", "id", ["late"]]);
  });
});

describe("backfill script isolation", () => {
  it("does not write bookings or ledger rows itself", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts/backfill-booking-refund-counters.ts"),
      "utf8"
    );
    expect(source).toContain("recordConsultRefundOnBooking");
    expect(source).not.toContain("amount_refunded");
    expect(source).not.toMatch(/from\(\s*["']bookings["']\s*\)\s*\.update/);
    expect(source).not.toMatch(/from\(\s*["']processed_webhook_events["']/);
    expect(source).not.toContain("markStatusRefunded");
  });
});
