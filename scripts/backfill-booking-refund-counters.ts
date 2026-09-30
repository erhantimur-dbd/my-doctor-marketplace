/**
 * One-off backfill for consult bookings refunded in Stripe before the
 * counters were recorded (PR #80, df52302).
 *
 * Those cancel paths moved money in Stripe and left
 * card_refunded_to_card_cents, card_credited_to_wallet_cents, and
 * credit_refunded_cents at 0. This script reads succeeded Stripe refund
 * objects and records each one through recordConsultRefundOnBooking, which
 * claims the refund id once. It does not flip a cancelled booking to
 * `refunded`. Wallet or credit refunds that have no Stripe refund object
 * are reported and left alone.
 *
 * Dry run is the default. Pass --apply to write. A live Stripe key is
 * refused unless --allow-live is passed. Pip runs this. Do not point it
 * at a real database or Stripe account from CI.
 *
 * Env: STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/backfill-booking-refund-counters.ts
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/backfill-booking-refund-counters.ts --apply --allow-live --booking-ids <uuid>,<uuid>
 */
import type Stripe from "stripe";
import { BOOKING_STATUSES } from "@/lib/constants/booking-status";
import { bookingRefundSettlementPatch } from "@/lib/stripe/consult-refund";
import { getStripe } from "@/lib/stripe/client";
import {
  recordConsultRefundOnBooking,
  type ConsultRefundBookingWriter,
} from "@/lib/stripe/record-consult-refund";
import { createAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 1000;

/** Same predicate as the read-only query in PR #80. */
export const BACKFILL_SELECTION_OR = [
  `status.in.(${BOOKING_STATUSES.CANCELLED_PATIENT},${BOOKING_STATUSES.CANCELLED_DOCTOR},${BOOKING_STATUSES.REFUNDED})`,
  "refunded_at.not.is.null",
  "refund_amount_cents.gt.0",
].join(",");

export const BACKFILL_BOOKING_COLUMNS = [
  "id",
  "booking_number",
  "status",
  "currency",
  "paid_at",
  "cancelled_at",
  "refunded_at",
  "cancellation_reason",
  "stripe_payment_intent_id",
  "stripe_charge_id",
  "payment_mode",
  "total_amount_cents",
  "deposit_amount_cents",
  "wallet_credit_applied_cents",
  "refund_amount_cents",
  "card_refunded_to_card_cents",
  "card_credited_to_wallet_cents",
  "credit_refunded_cents",
].join(", ");

const USAGE = `Backfill booking refund counters from succeeded Stripe refund objects.

Dry run is the default. Nothing is written unless --apply is passed.
A live Stripe key is refused unless --allow-live is passed.

Env:
  STRIPE_SECRET_KEY
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Dry run (all matching bookings):
  NODE_OPTIONS=--conditions=react-server npx tsx scripts/backfill-booking-refund-counters.ts

Dry run, one list (add --allow-live when the key is live):
  NODE_OPTIONS=--conditions=react-server npx tsx scripts/backfill-booking-refund-counters.ts --allow-live --booking-ids <uuid>,<uuid>

Apply that list:
  NODE_OPTIONS=--conditions=react-server npx tsx scripts/backfill-booking-refund-counters.ts --apply --allow-live --booking-ids <uuid>,<uuid>
`;

export class BackfillRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackfillRefusedError";
  }
}

export type CandidateBooking = {
  id: string;
  booking_number: string | null;
  status: string;
  currency: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  refunded_at: string | null;
  cancellation_reason: string | null;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  payment_mode: string | null;
  total_amount_cents: number | null;
  deposit_amount_cents: number | null;
  wallet_credit_applied_cents: number | null;
  refund_amount_cents: number | null;
  card_refunded_to_card_cents: number | null;
  card_credited_to_wallet_cents: number | null;
  credit_refunded_cents: number | null;
};

export type RefundSnapshot = {
  id: string;
  amount: number;
  created: number;
  status: string;
  reverseTransfer: boolean;
};

export type BackfillIo = {
  listCandidates(bookingIds?: string[]): Promise<CandidateBooking[]>;
  listChargeRefunds(chargeId: string): Promise<RefundSnapshot[]>;
  latestChargeId(paymentIntentId: string): Promise<string | null>;
};

export type CounterPreview = {
  card_refunded_to_card_cents: number;
  card_credited_to_wallet_cents: number;
  credit_refunded_cents: number;
  refund_amount_cents: number;
  refundedAt: "set" | "unchanged";
};

export type PlannedRefund = RefundSnapshot & { include: boolean };

export type BookingBackfillPlan = {
  bookingId: string;
  bookingNumber: string | null;
  status: string;
  chargeId: string | null;
  refunds: PlannedRefund[];
  wouldWrite: CounterPreview | null;
  notes: string[];
  skipReason?: string;
};

export type SkippedBooking = {
  id: string;
  bookingNumber: string | null;
  reason: string;
};

export type BackfillSummary = {
  stripeMode: "live" | "test" | "unknown";
  supabaseProjectRef: string;
  apply: boolean;
  scanned: number;
  wouldUpdate: number;
  updated: number;
  alreadyClaimed: number;
  skipped: SkippedBooking[];
  plans: BookingBackfillPlan[];
  stoppedOnError?: string;
};

export type BackfillArgs = {
  help: boolean;
  apply: boolean;
  allowLive: boolean;
  bookingIds?: string[];
};

type LogFn = (line: string) => void;

type BookingQuery = {
  select(columns: string): BookingQuery;
  not(column: string, operator: string, value: null): BookingQuery;
  eq(column: string, value: number): BookingQuery;
  or(filters: string): BookingQuery;
  in(column: string, values: string[]): BookingQuery;
  order(column: string, options: { ascending: boolean }): BookingQuery;
  range(
    from: number,
    to: number
  ): PromiseLike<{
    data: CandidateBooking[] | null;
    error: { message: string } | null;
  }>;
};

export type BackfillBookingDb = {
  from(table: "bookings"): BookingQuery;
};

export function parseBackfillArgs(argv: string[]): BackfillArgs {
  let help = false;
  let apply = false;
  let allowLive = false;
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

function selectionTimestamp(booking: CandidateBooking): string {
  return booking.refunded_at || booking.cancelled_at || booking.paid_at || "";
}

export async function listCandidateBookings(
  supabase: BackfillBookingDb,
  bookingIds?: string[]
): Promise<CandidateBooking[]> {
  if (bookingIds && bookingIds.length === 0) return [];

  const rows: CandidateBooking[] = [];
  let from = 0;
  for (;;) {
    let query = supabase
      .from("bookings")
      .select(BACKFILL_BOOKING_COLUMNS)
      .not("paid_at", "is", null)
      .eq("card_refunded_to_card_cents", 0)
      .eq("card_credited_to_wallet_cents", 0)
      .eq("credit_refunded_cents", 0)
      .or(BACKFILL_SELECTION_OR);
    if (bookingIds?.length) query = query.in("id", bookingIds);
    const { data, error } = await query
      .order("paid_at", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      throw new Error(`Booking selection failed: ${error.message}`);
    }
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  rows.sort(
    (a, b) =>
      selectionTimestamp(a).localeCompare(selectionTimestamp(b)) ||
      a.id.localeCompare(b.id)
  );
  return rows;
}

function cardSettlement(refund: RefundSnapshot) {
  return {
    cardRefundId: refund.id,
    cardRefundCents: refund.amount,
    cardRefundedToCardCents: refund.amount,
    creditRefundCents: 0,
    walletCreditCents: 0,
    alreadyApplied: false as const,
  };
}

function isRecordable(refund: RefundSnapshot): boolean {
  return refund.status === "succeeded" && refund.amount > 0;
}

function sortRefunds(refunds: readonly RefundSnapshot[]): RefundSnapshot[] {
  return [...refunds].sort(
    (a, b) => a.created - b.created || a.id.localeCompare(b.id)
  );
}

function withPatch(
  booking: CandidateBooking,
  patch: Record<string, unknown>
): CandidateBooking {
  return { ...booking, ...(patch as Partial<CandidateBooking>) };
}

function scopeNotes(booking: CandidateBooking): string[] {
  const credit = Math.max(0, Math.round(Number(booking.wallet_credit_applied_cents || 0)));
  if (credit <= 0) return [];
  return [
    `wallet_credit_applied_cents=${credit} is out of scope: wallet and credit refunds have no Stripe object and are not guessed`,
  ];
}

function previewSteps(booking: CandidateBooking, refunds: readonly RefundSnapshot[]) {
  let current = { ...booking };
  const steps: Array<{
    refund: RefundSnapshot;
    patch: Record<string, unknown>;
  }> = [];
  for (const refund of refunds) {
    if (!isRecordable(refund)) continue;
    const patch = bookingRefundSettlementPatch(current, cardSettlement(refund));
    if (!patch) continue;
    current = withPatch(current, patch);
    steps.push({ refund, patch });
  }
  return { current, steps };
}

function counterPreview(patch: Record<string, unknown> | undefined): CounterPreview | null {
  if (!patch) return null;
  return {
    card_refunded_to_card_cents: Number(patch.card_refunded_to_card_cents || 0),
    card_credited_to_wallet_cents: Number(patch.card_credited_to_wallet_cents || 0),
    credit_refunded_cents: Number(patch.credit_refunded_cents || 0),
    refund_amount_cents: Number(patch.refund_amount_cents || 0),
    refundedAt: patch.refunded_at ? "set" : "unchanged",
  };
}

function formatCounters(booking: CandidateBooking): string {
  return [
    `card_refunded_to_card_cents=${Number(booking.card_refunded_to_card_cents || 0)}`,
    `card_credited_to_wallet_cents=${Number(booking.card_credited_to_wallet_cents || 0)}`,
    `credit_refunded_cents=${Number(booking.credit_refunded_cents || 0)}`,
    `refund_amount_cents=${Number(booking.refund_amount_cents || 0)}`,
  ].join(" ");
}

function formatPreview(preview: CounterPreview, status: string): string {
  return [
    `card_refunded_to_card_cents=${preview.card_refunded_to_card_cents}`,
    `card_credited_to_wallet_cents=${preview.card_credited_to_wallet_cents}`,
    `credit_refunded_cents=${preview.credit_refunded_cents}`,
    `refund_amount_cents=${preview.refund_amount_cents}`,
    `refunded_at=${preview.refundedAt}`,
    `status=${status} (unchanged)`,
  ].join(" ");
}

function formatRefund(refund: PlannedRefund): string {
  const created = new Date(refund.created * 1000).toISOString();
  const use = refund.include ? "include" : "ignore";
  return `${refund.id} amount=${refund.amount} created=${created} status=${refund.status} reverse_transfer=${refund.reverseTransfer} ${use}`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "unexpected error";
}

function emptySummary(input: {
  stripeMode: BackfillSummary["stripeMode"];
  supabaseProjectRef: string;
  apply: boolean;
}): BackfillSummary {
  return {
    stripeMode: input.stripeMode,
    supabaseProjectRef: input.supabaseProjectRef,
    apply: input.apply,
    scanned: 0,
    wouldUpdate: 0,
    updated: 0,
    alreadyClaimed: 0,
    skipped: [],
    plans: [],
  };
}

export async function runBookingRefundCounterBackfill(input: {
  apply: boolean;
  allowLive: boolean;
  bookingIds?: string[];
  stripeSecretKey: string;
  supabaseUrl: string;
  io: BackfillIo;
  writer?: ConsultRefundBookingWriter;
  log?: LogFn;
}): Promise<BackfillSummary> {
  const secret = input.stripeSecretKey.trim();
  if (!secret) {
    throw new BackfillRefusedError("Missing STRIPE_SECRET_KEY. Refusing to run.");
  }
  const stripeMode = stripeKeyMode(secret);
  const projectRef = supabaseProjectRef(input.supabaseUrl);
  const log = input.log ?? console.log;
  log(`stripe mode: ${stripeMode}`);
  log(`supabase project: ${projectRef}`);
  if (stripeMode === "live" && !input.allowLive) {
    throw new BackfillRefusedError(
      "Stripe key is live. Refusing to run. Pass --allow-live to run against the live Stripe account."
    );
  }

  log(`run: ${input.apply ? "apply" : "dry-run"}`);
  if (input.bookingIds?.length) {
    log(`booking ids: ${input.bookingIds.join(",")}`);
  }
  log(
    "Amounts come from succeeded Stripe refund objects. Apply claims each refund id and will not add it twice."
  );

  const summary = emptySummary({
    stripeMode,
    supabaseProjectRef: projectRef,
    apply: input.apply,
  });

  try {
    const candidates = await input.io.listCandidates(input.bookingIds);
    const seen = new Set(candidates.map((booking) => booking.id));
    if (input.bookingIds) {
      for (const id of input.bookingIds) {
        if (seen.has(id)) continue;
        summary.skipped.push({
          id,
          bookingNumber: null,
          reason:
            "not in the paid cancelled-or-refunded zero-counter selection",
        });
      }
    }

    for (const booking of candidates) {
      const stopped = await backfillOne(booking, input, summary, log);
      if (stopped) break;
    }
  } catch (err) {
    summary.stoppedOnError = errorMessage(err);
  } finally {
    logSummary(log, summary);
  }

  return summary;
}

async function backfillOne(
  booking: CandidateBooking,
  input: {
    apply: boolean;
    io: BackfillIo;
    writer?: ConsultRefundBookingWriter;
  },
  summary: BackfillSummary,
  log: LogFn
): Promise<boolean> {
  summary.scanned += 1;
  const notes = scopeNotes(booking);
  const ref = booking.booking_number ?? "(no booking number)";
  log(`booking ${booking.id} ${ref}`);
  log(`  status: ${booking.status}`);
  log(`  currency: ${booking.currency ?? "unknown"}`);
  log(`  current counters: ${formatCounters(booking)}`);

  const charge = await resolveCharge(booking, input.io, summary, log);
  if (charge.stopped) return true;
  if (!charge.chargeId) {
    const reason = [charge.skipReason ?? "no Stripe charge", ...notes].join("; ");
    finishSkipped(summary, booking, reason, notes, null, [], log);
    return false;
  }
  log(`  stripe charge: ${charge.chargeId}`);

  let listed: RefundSnapshot[];
  try {
    listed = await input.io.listChargeRefunds(charge.chargeId);
  } catch (err) {
    summary.stoppedOnError = `Stripe refund lookup failed for ${booking.id} charge ${charge.chargeId}: ${errorMessage(err)}`;
    log(`stopped: ${summary.stoppedOnError}`);
    return true;
  }

  const sorted = sortRefunds(listed);
  const planned: PlannedRefund[] = sorted.map((refund) => ({
    ...refund,
    include: isRecordable(refund),
  }));
  if (planned.length === 0) {
    log("  stripe refunds: none");
  } else {
    log("  stripe refunds:");
    for (const refund of planned) log(`    ${formatRefund(refund)}`);
  }
  for (const note of notes) log(`  note: ${note}`);

  const { steps } = previewSteps(booking, sorted);
  const finalPreview = counterPreview(steps[steps.length - 1]?.patch);
  const plan: BookingBackfillPlan = {
    bookingId: booking.id,
    bookingNumber: booking.booking_number,
    status: booking.status,
    chargeId: charge.chargeId,
    refunds: planned,
    wouldWrite: finalPreview,
    notes,
  };

  if (steps.length === 0) {
    const ignored = planned.filter((refund) => !refund.include);
    const ignoredText = ignored.length
      ? ` (ignored: ${ignored.map((refund) => `${refund.id} ${refund.status}`).join(", ")})`
      : "";
    const reason = `no succeeded Stripe refund${ignoredText}; wallet or credit refunds without a Stripe object are out of scope and were not guessed`;
    plan.skipReason = reason;
    summary.plans.push(plan);
    summary.skipped.push({
      id: booking.id,
      bookingNumber: booking.booking_number,
      reason,
    });
    log(`  skip: ${reason}`);
    return false;
  }

  const verb = input.apply ? "writing" : "would write";
  for (const step of steps) {
    const preview = counterPreview(step.patch);
    if (!preview) continue;
    log(`  ${verb} ${step.refund.id}: ${formatPreview(preview, booking.status)}`);
  }
  summary.plans.push(plan);

  if (!input.apply) {
    summary.wouldUpdate += 1;
    return false;
  }

  let current = { ...booking };
  let wrote = 0;
  for (const step of steps) {
    let recorded: Awaited<ReturnType<typeof recordConsultRefundOnBooking>>;
    try {
      recorded = await recordConsultRefundOnBooking(
        {
          bookingId: booking.id,
          booking: current,
          settled: cardSettlement(step.refund),
        },
        input.writer ? { writer: input.writer } : undefined
      );
    } catch (err) {
      summary.stoppedOnError = `Write failed for ${booking.id} refund ${step.refund.id}: ${errorMessage(err)}`;
      log(`stopped: ${summary.stoppedOnError}`);
      if (wrote > 0) summary.updated += 1;
      return true;
    }

    if ("error" in recorded) {
      summary.stoppedOnError = recorded.error;
      log(
        `write error booking ${booking.id} refund ${step.refund.id}: ${recorded.error}`
      );
      if (wrote > 0) summary.updated += 1;
      return true;
    }

    if (recorded.alreadyRecorded) {
      summary.alreadyClaimed += 1;
      log(`  already claimed: ${step.refund.id}`);
      // The claim means this refund was already added. Keep it in the
      // running total so the next refund's absolute counters include it.
      current = withPatch(current, step.patch);
      continue;
    }

    wrote += 1;
    if (recorded.patch) current = withPatch(current, recorded.patch);
  }

  if (wrote > 0) summary.updated += 1;
  return false;
}

async function resolveCharge(
  booking: CandidateBooking,
  io: BackfillIo,
  summary: BackfillSummary,
  log: LogFn
): Promise<{ chargeId: string | null; skipReason?: string; stopped: boolean }> {
  const stored = booking.stripe_charge_id?.trim() || "";
  if (stored) return { chargeId: stored, stopped: false };

  const paymentIntentId = booking.stripe_payment_intent_id?.trim() || "";
  if (!paymentIntentId) {
    return {
      chargeId: null,
      stopped: false,
      skipReason:
        "no Stripe charge (stripe_charge_id empty and no stripe_payment_intent_id)",
    };
  }

  let latest: string | null;
  try {
    latest = await io.latestChargeId(paymentIntentId);
  } catch (err) {
    summary.stoppedOnError = `PaymentIntent lookup failed for ${booking.id} ${paymentIntentId}: ${errorMessage(err)}`;
    log(`stopped: ${summary.stoppedOnError}`);
    return { chargeId: null, stopped: true };
  }

  const chargeId = latest?.trim() || "";
  if (!chargeId) {
    return {
      chargeId: null,
      stopped: false,
      skipReason: `no Stripe charge (payment intent ${paymentIntentId} has no latest_charge)`,
    };
  }
  return { chargeId, stopped: false };
}

function finishSkipped(
  summary: BackfillSummary,
  booking: CandidateBooking,
  reason: string,
  notes: string[],
  chargeId: string | null,
  refunds: PlannedRefund[],
  log: LogFn
) {
  for (const note of notes) log(`  note: ${note}`);
  log(`  skip: ${reason}`);
  summary.skipped.push({
    id: booking.id,
    bookingNumber: booking.booking_number,
    reason,
  });
  summary.plans.push({
    bookingId: booking.id,
    bookingNumber: booking.booking_number,
    status: booking.status,
    chargeId,
    refunds,
    wouldWrite: null,
    notes,
    skipReason: reason,
  });
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

function refundSnapshot(refund: Stripe.Refund): RefundSnapshot {
  // stripe-node's Refund type omits reverse_transfer; the API still returns it.
  const reverseTransfer =
    (refund as Stripe.Refund & { reverse_transfer?: boolean }).reverse_transfer ===
    true;
  return {
    id: refund.id,
    amount: refund.amount,
    created: refund.created,
    status: refund.status ?? "",
    reverseTransfer,
  };
}

export function createDefaultBackfillIo(): BackfillIo {
  const stripe = getStripe();
  const supabase = createAdminClient();
  return {
    listCandidates(bookingIds) {
      return listCandidateBookings(supabase as unknown as BackfillBookingDb, bookingIds);
    },
    async listChargeRefunds(chargeId) {
      const refunds: RefundSnapshot[] = [];
      for await (const refund of stripe.refunds.list({ charge: chargeId, limit: 100 })) {
        refunds.push(refundSnapshot(refund));
      }
      return refunds;
    },
    async latestChargeId(paymentIntentId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      const latest = paymentIntent.latest_charge;
      if (!latest) return null;
      return typeof latest === "string" ? latest : latest.id;
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
  requireEnv("STRIPE_SECRET_KEY");
  requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const summary = await runBookingRefundCounterBackfill({
    apply: args.apply,
    allowLive: args.allowLive,
    bookingIds: args.bookingIds,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
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
