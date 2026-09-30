/**
 * One-off backfill for the 16 consult bookings in
 * scripts/data/refund-backfill-2026-09-30.json.
 *
 * Amounts come only from that payments-monitor table. Stripe is not listed.
 * Each row is one card refund written through recordConsultRefundOnBooking,
 * which claims the refund id once. Charge and destination-transfer ids, and
 * the migration 00123 reversal columns, are filled in that same update only
 * where they are null.
 *
 * BK-20260926-8BE0 (c1616576-…) is not in the table. Its payment carried
 * over to another booking and was not refunded. Do not add it.
 *
 * Balance rows store total_amount_cents 5000 while their own charge is £10.
 * The booking passed to recordConsultRefundOnBooking includes
 * rescheduled_from_booking_id, reschedule_price_diff_cents, and
 * reschedule_payment_status so storedConsultPaidParts caps the balance row
 * at that charge. Those keys are not filled in with null when the select
 * omitted them. An existing refunded_at is kept. Status is not changed.
 *
 * Dry run is the default. Pass --apply to write. A live Stripe key is
 * refused unless --allow-live is passed. Stripe is used only with
 * --lookup-reversal-created, and only to read a transfer reversal's created
 * time. Pip runs this. Do not point it at a real database from CI.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * STRIPE_SECRET_KEY is required only for --lookup-reversal-created. If it
 * is set and live, --allow-live is required either way.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/backfill-booking-refund-counters.ts --allow-live
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/backfill-booking-refund-counters.ts --apply --allow-live --booking-ids <uuid>,<uuid>
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { transferReversalRecord } from "@/lib/stripe/connect-event-handlers";
import { getStripe } from "@/lib/stripe/client";
import {
  bookingRefundSettlementPatch,
  storedConsultPaidParts,
} from "@/lib/stripe/consult-refund";
import {
  recordConsultRefundOnBooking,
  type ConsultRefundBookingWriter,
} from "@/lib/stripe/record-consult-refund";
import { createAdminClient } from "@/lib/supabase/admin";

const TABLE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "data/refund-backfill-2026-09-30.json"
);

const BOOKING_COLUMNS = [
  "id",
  "booking_number",
  "status",
  "payment_mode",
  "total_amount_cents",
  "deposit_amount_cents",
  "wallet_credit_applied_cents",
  "rescheduled_from_booking_id",
  "reschedule_price_diff_cents",
  "reschedule_payment_status",
  "refund_amount_cents",
  "refunded_at",
  "card_refunded_to_card_cents",
  "card_credited_to_wallet_cents",
  "credit_refunded_cents",
  "stripe_payment_intent_id",
  "stripe_charge_id",
  "stripe_destination_transfer_id",
  "destination_transfer_reversed_cents",
  "destination_transfer_reversed_at",
  "destination_transfer_reversal_reconciled_at",
].join(", ");

const USAGE = `Backfill booking refund counters from scripts/data/refund-backfill-2026-09-30.json.

Dry run is the default. Nothing is written unless --apply is passed.
Amounts come from that file, not from Stripe. A live Stripe key is refused
unless --allow-live is passed.

Env:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  STRIPE_SECRET_KEY   only for --lookup-reversal-created; a live key still
                      requires --allow-live when it is set

Dry run:
  NODE_OPTIONS=--conditions=react-server npx tsx scripts/backfill-booking-refund-counters.ts --allow-live

Dry run, one list:
  NODE_OPTIONS=--conditions=react-server npx tsx scripts/backfill-booking-refund-counters.ts --allow-live --booking-ids <uuid>,<uuid>

Apply that list:
  NODE_OPTIONS=--conditions=react-server npx tsx scripts/backfill-booking-refund-counters.ts --apply --allow-live --booking-ids <uuid>,<uuid>
`;

const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

export class BackfillRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackfillRefusedError";
  }
}

export type RefundBackfillRow = {
  ref: string;
  booking_id: string;
  leg: string;
  payment_intent: string;
  charge: string;
  transfer: string;
  refund: string | null;
  refund_amount_cents: number | null;
  refund_succeeded_bst: string | null;
  transfer_reversal: string | null;
  transfer_reversed_cents: number | null;
};

export type BookingSnapshot = {
  id: string;
  booking_number: string | null;
  status: string;
  payment_mode: string | null;
  total_amount_cents: number | null;
  deposit_amount_cents: number | null;
  wallet_credit_applied_cents: number | null;
  rescheduled_from_booking_id: string | null;
  reschedule_price_diff_cents: number | null;
  reschedule_payment_status: string | null;
  refund_amount_cents: number | null;
  refunded_at: string | null;
  card_refunded_to_card_cents: number | null;
  card_credited_to_wallet_cents: number | null;
  credit_refunded_cents: number | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_destination_transfer_id: string | null;
  destination_transfer_reversed_cents: number | null;
  destination_transfer_reversed_at: string | null;
  destination_transfer_reversal_reconciled_at: string | null;
};

export type BackfillIo = {
  loadBookings(ids: string[]): Promise<BookingSnapshot[]>;
  reversalCreatedAt?(transferId: string, reversalId: string): Promise<number>;
};

export type BackfillArgs = {
  help: boolean;
  apply: boolean;
  allowLive: boolean;
  lookupReversalCreated: boolean;
  bookingIds?: string[];
};

export type SkippedBooking = {
  id: string;
  bookingNumber: string | null;
  reason: string;
};

export type BackfillSummary = {
  stripeMode: "live" | "test" | "unknown" | "not used";
  supabaseProjectRef: string;
  apply: boolean;
  scanned: number;
  wouldUpdate: number;
  updated: number;
  alreadyClaimed: number;
  skipped: SkippedBooking[];
  stoppedOnError?: string;
};

type LogFn = (line: string) => void;

type BookingSelect = {
  select(columns: string): {
    in(
      column: string,
      values: string[]
    ): PromiseLike<{
      data: BookingSnapshot[] | null;
      error: { message: string } | null;
    }>;
  };
};

export type BackfillBookingDb = {
  from(table: "bookings"): BookingSelect;
};

type PlannedWrite = {
  row: RefundBackfillRow;
  booking: BookingSnapshot;
  refundId: string;
  amountCents: number;
  patch: Record<string, unknown>;
  extra: Record<string, unknown>;
  reversedAt: string;
};

export function loadRefundBackfillTable(path = TABLE_PATH): RefundBackfillRow[] {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as RefundBackfillRow[];
  if (!Array.isArray(parsed)) {
    throw new BackfillRefusedError("Refund backfill table is not a JSON array.");
  }
  return parsed;
}

export function parseBackfillArgs(argv: string[]): BackfillArgs {
  let help = false;
  let apply = false;
  let allowLive = false;
  let lookupReversalCreated = false;
  let sawBookingIds = false;
  const bookingIds: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      help = true;
      continue;
    }
    if (arg === "--apply") {
      apply = true;
      continue;
    }
    if (arg === "--allow-live") {
      allowLive = true;
      continue;
    }
    if (arg === "--lookup-reversal-created") {
      lookupReversalCreated = true;
      continue;
    }
    if (arg === "--booking-ids" || arg.startsWith("--booking-ids=")) {
      sawBookingIds = true;
      const raw =
        arg === "--booking-ids" ? argv[++i] : arg.slice("--booking-ids=".length);
      if (!raw || raw.startsWith("--")) {
        throw new BackfillRefusedError(
          "--booking-ids requires a comma-separated list of booking ids."
        );
      }
      for (const part of raw.split(",")) {
        const id = part.trim();
        if (id) bookingIds.push(id);
      }
      continue;
    }
    throw new BackfillRefusedError(`Unknown argument: ${arg}`);
  }

  if (sawBookingIds && bookingIds.length === 0) {
    throw new BackfillRefusedError("--booking-ids was empty.");
  }

  return {
    help,
    apply,
    allowLive,
    lookupReversalCreated,
    bookingIds: sawBookingIds ? [...new Set(bookingIds)] : undefined,
  };
}

export function stripeKeyMode(secretKey: string): "live" | "test" | "unknown" {
  const key = secretKey.trim();
  if (/_live_/i.test(key) || /^(sk|rk)_live/i.test(key)) return "live";
  if (/_test_/i.test(key) || /^(sk|rk)_test/i.test(key)) return "test";
  return "unknown";
}

export function supabaseProjectRef(supabaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(supabaseUrl);
  } catch {
    throw new BackfillRefusedError(
      `NEXT_PUBLIC_SUPABASE_URL is not a URL: ${supabaseUrl}`
    );
  }
  const match = url.hostname.match(/^([a-z0-9-]+)\.supabase\.(co|in)$/i);
  return match?.[1] ?? url.hostname;
}

export function yearFromBookingRef(ref: string): number {
  const match = /^BK-(\d{4})/.exec(ref);
  if (!match) {
    throw new BackfillRefusedError(`Booking ref has no year: ${ref}`);
  }
  return Number(match[1]);
}

/** "26 Sep 22:20:40 BST" → UTC ISO. BST is UTC+1. */
export function bstStampToUtcIso(stamp: string, year: number): string {
  const match = /^(\d{1,2}) ([A-Za-z]{3}) (\d{2}):(\d{2}):(\d{2}) BST$/.exec(
    stamp.trim()
  );
  if (!match) {
    throw new BackfillRefusedError(`Cannot parse refund time: ${stamp}`);
  }
  const month = MONTHS[match[2]];
  if (month == null) {
    throw new BackfillRefusedError(`Cannot parse refund time: ${stamp}`);
  }
  return new Date(
    Date.UTC(
      year,
      month,
      Number(match[1]),
      Number(match[3]) - 1,
      Number(match[4]),
      Number(match[5])
    )
  ).toISOString();
}

export async function loadBookingsById(
  supabase: BackfillBookingDb,
  ids: string[]
): Promise<BookingSnapshot[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_COLUMNS)
    .in("id", ids);
  if (error) throw new Error(`Booking load failed: ${error.message}`);
  return data ?? [];
}

function storedId(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}

function countersAreZero(booking: BookingSnapshot): boolean {
  return (
    Number(booking.card_refunded_to_card_cents || 0) === 0 &&
    Number(booking.card_credited_to_wallet_cents || 0) === 0 &&
    Number(booking.credit_refunded_cents || 0) === 0
  );
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "unexpected error";
}

function display(value: unknown): string {
  if (value == null || value === "") return "null";
  return String(value);
}

function diffLine(field: string, before: unknown, after: unknown): string {
  const left = display(before);
  const right = display(after);
  if (left === right) return `  ${field}: ${left} (unchanged)`;
  return `  ${field}: ${left} -> ${right}`;
}

/**
 * Same columns as handleTransferReversed, using the table amount rather than
 * a Stripe amount_reversed. Null columns are filled. A stored value that is
 * already at least the table amount is left alone, matching transferReversalRecord.
 */
export function reversalFill(input: {
  booking: BookingSnapshot;
  reversedCents: number;
  reversedAt: string;
}): Record<string, unknown> {
  const record = transferReversalRecord({
    storedReversedCents: input.booking.destination_transfer_reversed_cents,
    stripeAmountReversedCents: input.reversedCents,
  });
  const extra: Record<string, unknown> = {};
  if (
    input.booking.destination_transfer_reversed_cents == null &&
    !record.alreadyRecorded
  ) {
    extra.destination_transfer_reversed_cents = record.nextReversedCents;
  }
  if (
    input.booking.destination_transfer_reversed_at == null &&
    !record.alreadyRecorded
  ) {
    extra.destination_transfer_reversed_at = input.reversedAt;
  }
  if (input.booking.destination_transfer_reversal_reconciled_at == null) {
    extra.destination_transfer_reversal_reconciled_at = input.reversedAt;
  }
  return extra;
}

function idFill(
  booking: BookingSnapshot,
  row: RefundBackfillRow
): { extra: Record<string, unknown>; mismatches: string[] } {
  const extra: Record<string, unknown> = {};
  const mismatches: string[] = [];
  const charge = storedId(booking.stripe_charge_id);
  const transfer = storedId(booking.stripe_destination_transfer_id);
  if (charge && charge !== row.charge) {
    mismatches.push(
      `stripe_charge_id ${charge} differs from table ${row.charge}`
    );
  } else if (!charge) {
    extra.stripe_charge_id = row.charge;
  }
  if (transfer && transfer !== row.transfer) {
    mismatches.push(
      `stripe_destination_transfer_id ${transfer} differs from table ${row.transfer}`
    );
  } else if (!transfer) {
    extra.stripe_destination_transfer_id = row.transfer;
  }
  return { extra, mismatches };
}

function afterValue(
  before: unknown,
  patch: Record<string, unknown>,
  field: string
): unknown {
  return Object.prototype.hasOwnProperty.call(patch, field) ? patch[field] : before;
}

function logPlan(
  log: LogFn,
  planned: PlannedWrite,
  verb: "would write" | "writing"
) {
  const { row, booking } = planned;
  const patch = { ...planned.patch, ...planned.extra };
  log(`booking ${row.ref} ${row.booking_id} leg=${row.leg}`);
  log(diffLine("status", booking.status, booking.status));
  log(
    diffLine(
      "refunded_at",
      booking.refunded_at,
      afterValue(booking.refunded_at, patch, "refunded_at")
    )
  );
  log(
    diffLine(
      "card_refunded_to_card_cents",
      Number(booking.card_refunded_to_card_cents || 0),
      patch.card_refunded_to_card_cents
    )
  );
  log(
    diffLine(
      "card_credited_to_wallet_cents",
      Number(booking.card_credited_to_wallet_cents || 0),
      patch.card_credited_to_wallet_cents
    )
  );
  log(
    diffLine(
      "credit_refunded_cents",
      Number(booking.credit_refunded_cents || 0),
      patch.credit_refunded_cents
    )
  );
  log(
    diffLine(
      "refund_amount_cents",
      booking.refund_amount_cents,
      afterValue(booking.refund_amount_cents, patch, "refund_amount_cents")
    )
  );
  log(
    diffLine(
      "stripe_charge_id",
      storedId(booking.stripe_charge_id),
      afterValue(storedId(booking.stripe_charge_id), patch, "stripe_charge_id")
    )
  );
  log(
    diffLine(
      "stripe_destination_transfer_id",
      storedId(booking.stripe_destination_transfer_id),
      afterValue(
        storedId(booking.stripe_destination_transfer_id),
        patch,
        "stripe_destination_transfer_id"
      )
    )
  );
  log(
    diffLine(
      "destination_transfer_reversed_cents",
      booking.destination_transfer_reversed_cents,
      afterValue(
        booking.destination_transfer_reversed_cents,
        patch,
        "destination_transfer_reversed_cents"
      )
    )
  );
  log(
    diffLine(
      "destination_transfer_reversed_at",
      booking.destination_transfer_reversed_at,
      afterValue(
        booking.destination_transfer_reversed_at,
        patch,
        "destination_transfer_reversed_at"
      )
    )
  );
  log(
    diffLine(
      "destination_transfer_reversal_reconciled_at",
      booking.destination_transfer_reversal_reconciled_at,
      afterValue(
        booking.destination_transfer_reversal_reconciled_at,
        patch,
        "destination_transfer_reversal_reconciled_at"
      )
    )
  );
  log(`  ${verb} refund ${row.refund} amount=${row.refund_amount_cents}`);
}

function logSummary(log: LogFn, summary: BackfillSummary) {
  const action = summary.apply ? "updated" : "would-update";
  const actionCount = summary.apply ? summary.updated : summary.wouldUpdate;
  log(
    `summary mode=${summary.apply ? "apply" : "dry-run"} stripe=${summary.stripeMode} supabase=${summary.supabaseProjectRef} scanned=${summary.scanned} ${action}=${actionCount} skipped=${summary.skipped.length} already-claimed=${summary.alreadyClaimed}`
  );
  for (const skip of summary.skipped) {
    const ref = skip.bookingNumber ? ` ${skip.bookingNumber}` : "";
    log(`skipped ${skip.id}${ref}: ${skip.reason}`);
  }
  if (summary.stoppedOnError) log(`stopped: ${summary.stoppedOnError}`);
}

function skip(
  summary: BackfillSummary,
  row: { booking_id: string; ref: string | null },
  reason: string,
  log: LogFn
) {
  summary.scanned += 1;
  summary.skipped.push({
    id: row.booking_id,
    bookingNumber: row.ref,
    reason,
  });
  const label = row.ref ? `${row.ref} ` : "";
  log(`booking ${label}${row.booking_id}`);
  log(`  skip: ${reason}`);
}

export async function runBookingRefundCounterBackfill(input: {
  apply: boolean;
  allowLive: boolean;
  lookupReversalCreated?: boolean;
  bookingIds?: string[];
  stripeSecretKey?: string;
  supabaseUrl: string;
  rows: RefundBackfillRow[];
  io: BackfillIo;
  writer?: ConsultRefundBookingWriter;
  log?: LogFn;
}): Promise<BackfillSummary> {
  const secret = input.stripeSecretKey?.trim() ?? "";
  const stripeMode = secret ? stripeKeyMode(secret) : "not used";
  const projectRef = supabaseProjectRef(input.supabaseUrl);
  const log = input.log ?? console.log;
  log(`supabase project: ${projectRef}`);
  log(`stripe mode: ${stripeMode}`);
  if (input.lookupReversalCreated && !secret) {
    throw new BackfillRefusedError(
      "Missing STRIPE_SECRET_KEY. Refusing to look up transfer reversals."
    );
  }
  if (stripeMode === "live" && !input.allowLive) {
    throw new BackfillRefusedError(
      "Stripe key is live. Refusing to run. Pass --allow-live to run against the live Stripe account."
    );
  }

  log(`run: ${input.apply ? "apply" : "dry-run"}`);
  log(
    "Amounts come from the payments-monitor table. Apply claims each refund id and will not add it twice."
  );
  if (input.bookingIds?.length) {
    log(`booking ids: ${input.bookingIds.join(",")}`);
  }

  const summary: BackfillSummary = {
    stripeMode,
    supabaseProjectRef: projectRef,
    apply: input.apply,
    scanned: 0,
    wouldUpdate: 0,
    updated: 0,
    alreadyClaimed: 0,
    skipped: [],
  };

  try {
    const known = new Set(input.rows.map((row) => row.booking_id));
    const selected = input.bookingIds
      ? input.rows.filter((row) => input.bookingIds!.includes(row.booking_id))
      : input.rows;
    if (input.bookingIds) {
      for (const id of input.bookingIds) {
        if (known.has(id)) continue;
        summary.skipped.push({
          id,
          bookingNumber: null,
          reason: "not in the refund backfill table",
        });
        log(`booking ${id}`);
        log("  skip: not in the refund backfill table");
      }
    }

    const toLoad = selected.filter(
      (row) => row.refund && row.refund_amount_cents != null
    );
    const loaded = await input.io.loadBookings(toLoad.map((row) => row.booking_id));
    const byId = new Map(loaded.map((booking) => [booking.id, booking]));
    const planned: PlannedWrite[] = [];

    for (const row of selected) {
      if (!row.refund || row.refund_amount_cents == null) {
        skip(
          summary,
          row,
          "no refund in the payments-monitor table; booking was not refunded and is not touched",
          log
        );
        continue;
      }

      const booking = byId.get(row.booking_id);
      if (!booking) {
        skip(summary, row, "booking not found", log);
        continue;
      }
      if (booking.booking_number && booking.booking_number !== row.ref) {
        skip(
          summary,
          row,
          `booking_number ${booking.booking_number} differs from table ${row.ref}`,
          log
        );
        continue;
      }
      if (!countersAreZero(booking)) {
        skip(
          summary,
          row,
          `counters are not 0 (card_refunded_to_card_cents=${Number(booking.card_refunded_to_card_cents || 0)} card_credited_to_wallet_cents=${Number(booking.card_credited_to_wallet_cents || 0)} credit_refunded_cents=${Number(booking.credit_refunded_cents || 0)})`,
          log
        );
        continue;
      }
      if (Number(booking.refund_amount_cents) !== row.refund_amount_cents) {
        skip(
          summary,
          row,
          `refund_amount_cents ${display(booking.refund_amount_cents)} does not equal table ${row.refund_amount_cents}`,
          log
        );
        continue;
      }

      const ids = idFill(booking, row);
      if (ids.mismatches.length > 0) {
        skip(summary, row, ids.mismatches.join("; "), log);
        continue;
      }

      const paid = storedConsultPaidParts(booking);
      if (paid.cardPaidCents !== row.refund_amount_cents) {
        skip(
          summary,
          row,
          `own card charge is ${paid.cardPaidCents} cents, table refund is ${row.refund_amount_cents}; refusing to use total_amount_cents ${display(booking.total_amount_cents)}`,
          log
        );
        continue;
      }

      let reversedAt: string;
      if (input.lookupReversalCreated) {
        if (!row.transfer_reversal) {
          skip(summary, row, "table row has no transfer_reversal id", log);
          continue;
        }
        const created = await input.io.reversalCreatedAt!(
          row.transfer,
          row.transfer_reversal
        );
        reversedAt = new Date(created * 1000).toISOString();
      } else {
        if (!row.refund_succeeded_bst) {
          skip(summary, row, "table row has no refund_succeeded_bst", log);
          continue;
        }
        reversedAt = bstStampToUtcIso(
          row.refund_succeeded_bst,
          yearFromBookingRef(row.ref)
        );
      }

      const money = bookingRefundSettlementPatch(booking, {
        cardRefundCents: row.refund_amount_cents,
        cardRefundedToCardCents: row.refund_amount_cents,
        creditRefundCents: 0,
        walletCreditCents: 0,
        alreadyApplied: false,
      });
      if (!money) {
        skip(summary, row, "settlement patch was empty", log);
        continue;
      }
      const extra: Record<string, unknown> = {
        ...ids.extra,
        ...reversalFill({
          booking,
          reversedCents: Number(row.transfer_reversed_cents || 0),
          reversedAt,
        }),
      };
      if (booking.refunded_at) extra.refunded_at = booking.refunded_at;
      planned.push({
        row,
        booking,
        refundId: row.refund,
        amountCents: row.refund_amount_cents,
        patch: money,
        extra,
        reversedAt,
      });
      summary.scanned += 1;
    }

    const verb = input.apply ? "writing" : "would write";
    for (const plan of planned) logPlan(log, plan, verb);

    if (!input.apply) {
      summary.wouldUpdate = planned.length;
      return summary;
    }

    for (const plan of planned) {
      let recorded: Awaited<ReturnType<typeof recordConsultRefundOnBooking>>;
      try {
        recorded = await recordConsultRefundOnBooking(
          {
            bookingId: plan.booking.id,
            booking: plan.booking,
            settled: {
              cardRefundId: plan.refundId,
              cardRefundCents: plan.amountCents,
              cardRefundedToCardCents: plan.amountCents,
              creditRefundCents: 0,
              walletCreditCents: 0,
              alreadyApplied: false,
            },
            extra: plan.extra,
          },
          input.writer ? { writer: input.writer } : undefined
        );
      } catch (err) {
        summary.stoppedOnError = `Write failed for ${plan.row.ref} refund ${plan.row.refund}: ${errorMessage(err)}`;
        log(`stopped: ${summary.stoppedOnError}`);
        return summary;
      }

      if ("error" in recorded) {
        summary.stoppedOnError = recorded.error;
        log(
          `write error booking ${plan.row.ref} refund ${plan.row.refund}: ${recorded.error}`
        );
        return summary;
      }
      if (recorded.alreadyRecorded) {
        summary.alreadyClaimed += 1;
        log(`  already claimed: ${plan.row.refund}`);
        continue;
      }
      summary.updated += 1;
    }
  } catch (err) {
    summary.stoppedOnError = errorMessage(err);
  } finally {
    logSummary(log, summary);
  }

  return summary;
}

export function createDefaultBackfillIo(): BackfillIo {
  const supabase = createAdminClient();
  return {
    loadBookings(ids) {
      return loadBookingsById(supabase as unknown as BackfillBookingDb, ids);
    },
    async reversalCreatedAt(transferId, reversalId) {
      const reversal = await getStripe().transfers.retrieveReversal(
        transferId,
        reversalId
      );
      return reversal.created;
    },
  };
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new BackfillRefusedError(`Missing ${name}. Refusing to run.`);
  }
  return value;
}

async function main() {
  const args = parseBackfillArgs(process.argv.slice(2));
  if (args.help) {
    console.log(USAGE);
    return;
  }
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const summary = await runBookingRefundCounterBackfill({
    apply: args.apply,
    allowLive: args.allowLive,
    lookupReversalCreated: args.lookupReversalCreated,
    bookingIds: args.bookingIds,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    supabaseUrl,
    rows: loadRefundBackfillTable(),
    io: createDefaultBackfillIo(),
  });
  if (summary.stoppedOnError) process.exitCode = 1;
}

const entry = process.argv[1]?.replaceAll("\\", "/") ?? "";
if (
  entry.endsWith("/backfill-booking-refund-counters.ts") ||
  entry.endsWith("/backfill-booking-refund-counters.js")
) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
