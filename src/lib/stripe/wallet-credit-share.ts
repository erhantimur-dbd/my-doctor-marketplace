/**
 * Doctor share of a consult paid with MyDoctors360 wallet or gift-card credit.
 *
 * Card portion: destination charge, application fee = 15% of the card amount.
 * Credit portion: (credit − 15%) is a Transfer from the platform balance.
 * bookings.commission_cents is 15% of the card plus 15% of the credit.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { debitWallet } from "@/lib/wallet";
import { getCommissionCents } from "@/lib/utils/currency";
import { log } from "@/lib/utils/logger";
import { getStripe } from "@/lib/stripe/client";
import {
  DOCTOR_CARD_PAYMENTS_UNAVAILABLE_MESSAGE,
  doctorCanReceiveConsultCreditPayment,
} from "@/lib/stripe/consult-merchant";
import {
  createConnectTransfer,
  reverseConnectTransfer,
  type ConnectTransferClient,
} from "@/lib/stripe/transfer-handoff";

export const WALLET_CREDIT_SHARE_KIND = "wallet_credit_share";

/** Activity statements read this line off the transfer row. */
export const PAID_WITH_WALLET_CREDIT_LINE = "Paid with MyDoctors360 credit";

export const WALLET_CREDIT_PAYOUT_FAILED_MESSAGE =
  "We couldn't pay this doctor just now. Please try again.";

const CREDIT_DEBIT_FAILED_MESSAGE =
  "We couldn't apply your MyDoctors360 credit. Please try again.";

export function walletCreditShareIdempotencyKey(bookingId: string): string {
  return `wallet-credit-share-${bookingId}`;
}

export function walletCreditTransferGroup(bookingId: string): string {
  return `booking_${bookingId}`;
}

/**
 * One refund, one key. The cursor is the credit already returned before this
 * refund plus the credit this refund returns, so two partials do not collide
 * and a replay of the same refund repeats the same key.
 */
export function walletCreditReversalIdempotencyKey(
  bookingId: string,
  creditRefundedBeforeCents: number,
  refundedCreditCents: number
): string {
  return `wallet-credit-reversal-${bookingId}-${creditRefundedBeforeCents}-${refundedCreditCents}`;
}

function creditRefundCursor(input: {
  originalCreditCents: number;
  creditOutstandingCents: number;
  refundedCreditCents: number;
}): {
  original: number;
  outstanding: number;
  before: number;
  after: number;
  refunded: number;
} {
  const original = Math.max(0, Math.round(input.originalCreditCents));
  const outstanding = Math.max(0, Math.round(input.creditOutstandingCents));
  const refunded = Math.max(0, Math.round(input.refundedCreditCents));
  const before = Math.max(0, original - Math.min(original, outstanding));
  return { original, outstanding, before, after: before + refunded, refunded };
}

export interface ConsultCheckoutMoney {
  cardCents: number;
  creditCents: number;
  cardCommissionCents: number;
  creditCommissionCents: number;
  /** Stripe application_fee_amount. 15% of the card only when credit is used. */
  applicationFeeCents: number;
  /** Whole-booking commission stored on bookings.commission_cents. */
  commissionCents: number;
  /** Credit minus 15%, sent as a platform transfer. */
  doctorCreditShareCents: number;
}

/**
 * Split a consult charge into card and MyDoctors360 credit.
 * With no credit, the application fee stays the historical deposit rule:
 * 15% of the consultation fee, capped at the amount Stripe will charge.
 */
export function consultCheckoutMoney(input: {
  consultationFeeCents: number;
  stripeChargeCents: number;
  walletCreditCents: number;
}): ConsultCheckoutMoney {
  const creditCents = Math.max(
    0,
    Math.min(input.walletCreditCents, input.stripeChargeCents)
  );
  const cardCents = input.stripeChargeCents - creditCents;
  const cardCommissionCents = getCommissionCents(cardCents);
  const creditCommissionCents = getCommissionCents(creditCents);
  const consultationCommission = getCommissionCents(input.consultationFeeCents);
  const baselineFee = Math.min(consultationCommission, input.stripeChargeCents);

  return {
    cardCents,
    creditCents,
    cardCommissionCents,
    creditCommissionCents,
    applicationFeeCents: creditCents > 0 ? cardCommissionCents : baselineFee,
    commissionCents:
      creditCents > 0
        ? cardCommissionCents + creditCommissionCents
        : consultationCommission,
    doctorCreditShareCents: Math.max(0, creditCents - creditCommissionCents),
  };
}

export function walletCreditDoctorShare(creditAmountCents: number): {
  creditAmountCents: number;
  commissionCents: number;
  amountCents: number;
} {
  const commissionCents = getCommissionCents(creditAmountCents);
  return {
    creditAmountCents,
    commissionCents,
    amountCents: Math.max(0, creditAmountCents - commissionCents),
  };
}

/**
 * Doctor-share cents to reverse for one credit refund.
 *
 * The share follows the original gross credit, not the credit still
 * outstanding:
 *   round(transfer * creditReturned / originalCredit).
 * Each call reverses only the increase in that cumulative share, capped at
 * the transfer that is still outstanding. When this refund finishes the
 * credit, the target is the whole transfer, so the last reversal is the
 * exact remainder and rounding cannot leave or take a cent. A replay, whose
 * cumulative share is already on the row, returns 0.
 */
export function proportionalCreditTransferReversalCents(input: {
  transferAmountCents: number;
  alreadyReversedCents: number;
  refundedCreditCents: number;
  originalCreditCents: number;
  /** Credit still unpaid-back before this refund. Not the proportion base. */
  creditOutstandingCents: number;
}): number {
  const transfer = Math.max(0, Math.round(input.transferAmountCents));
  const already = Math.max(0, Math.round(input.alreadyReversedCents));
  const remainingTransfer = Math.max(0, transfer - already);
  const cursor = creditRefundCursor(input);
  if (
    remainingTransfer <= 0 ||
    cursor.refunded <= 0 ||
    cursor.original <= 0 ||
    cursor.outstanding <= 0
  ) {
    return 0;
  }

  const expectedAfter =
    cursor.after >= cursor.original
      ? transfer
      : Math.min(
          transfer,
          Math.max(0, Math.round((transfer * cursor.after) / cursor.original))
        );

  return Math.max(0, Math.min(remainingTransfer, expectedAfter - already));
}

export type WalletCreditTransferStatus =
  | "pending"
  | "paid"
  | "reversed"
  | "partially_reversed";

/** Thrown when doctor_wallet_credit_transfers is not in the database. */
export class WalletCreditTableMissingError extends Error {
  readonly code: "42P01" | "PGRST205";

  constructor(code: "42P01" | "PGRST205") {
    super("doctor_wallet_credit_transfers is not available");
    this.name = "WalletCreditTableMissingError";
    this.code = code;
  }
}

export function walletCreditTableMissingCode(
  error: { code?: string } | null | undefined
): "42P01" | "PGRST205" | null {
  if (error?.code === "42P01" || error?.code === "PGRST205") return error.code;
  return null;
}

export interface WalletCreditTransferRecord {
  id: string;
  booking_id: string;
  doctor_id: string;
  amount_cents: number;
  credit_amount_cents: number;
  commission_cents: number;
  stripe_transfer_id: string | null;
  status: WalletCreditTransferStatus;
  statement_line: string;
  currency: string;
  reversed_cents: number;
  kind: string;
  created_at: string;
}

export interface WalletCreditTransferStore {
  findByBookingId(
    bookingId: string
  ): Promise<WalletCreditTransferRecord | null>;
  insert(
    row: Omit<WalletCreditTransferRecord, "id" | "created_at">
  ): Promise<WalletCreditTransferRecord>;
  update(
    bookingId: string,
    patch: Partial<
      Pick<
        WalletCreditTransferRecord,
        "status" | "reversed_cents" | "stripe_transfer_id"
      >
    >
  ): Promise<void>;
}

export interface WalletCreditDeps {
  stripe?: ConnectTransferClient & {
    refunds?: {
      create(
        params: {
          payment_intent: string;
          amount: number;
          reverse_transfer: boolean;
          refund_application_fee: boolean;
        },
        options?: { idempotencyKey?: string }
      ): Promise<{ id: string }>;
    };
  };
  store?: WalletCreditTransferStore;
  alreadyDebited?: (bookingId: string) => Promise<boolean>;
  debit?: () => Promise<void>;
}

export function consultCardRefundIdempotencyKey(
  bookingId: string,
  cardRefundCents: number,
  alreadyRefundedCents = 0
): string {
  return `consult-card-refund-${bookingId}-${alreadyRefundedCents}-${cardRefundCents}`;
}

const TABLE = "doctor_wallet_credit_transfers";

async function findWalletCreditTransfer(
  bookingId: string
): Promise<WalletCreditTransferRecord | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error) {
    const missing = walletCreditTableMissingCode(error);
    if (missing) {
      log.error("[wallet-credit] transfer table unavailable", {
        code: error.code,
        message: error.message,
      });
      throw new WalletCreditTableMissingError(missing);
    }
    throw new Error(error.message);
  }
  return (data as WalletCreditTransferRecord | null) ?? null;
}

function supabaseStore(): WalletCreditTransferStore {
  const supabase = createAdminClient();
  return {
    findByBookingId: findWalletCreditTransfer,
    async insert(row) {
      const { data, error } = await supabase
        .from(TABLE)
        .insert(row)
        .select("*")
        .single();
      if (error) {
        const missing = walletCreditTableMissingCode(error);
        if (missing) {
          throw new WalletCreditTableMissingError(missing);
        }
        if (error.code === "23505") {
          const existing = await findWalletCreditTransfer(row.booking_id);
          if (existing) return existing;
        }
        throw new Error(error.message);
      }
      return data as WalletCreditTransferRecord;
    },
    async update(bookingId, patch) {
      const { error } = await supabase.from(TABLE).update(patch).eq("booking_id", bookingId);
      if (error) throw new Error(error.message);
    },
  };
}

function storeOf(deps?: WalletCreditDeps): WalletCreditTransferStore {
  return deps?.store ?? supabaseStore();
}

function transferClient(deps?: WalletCreditDeps): ConnectTransferClient {
  return deps?.stripe ?? (getStripe() as unknown as ConnectTransferClient);
}

export interface PayDoctorWalletCreditInput {
  bookingId: string;
  bookingNumber: string;
  doctorId: string;
  stripeAccountId: string;
  currency: string;
  creditAmountCents: number;
  commissionCents: number;
  amountCents: number;
}

function pendingTransferRow(
  input: PayDoctorWalletCreditInput
): Omit<WalletCreditTransferRecord, "id" | "created_at"> {
  return {
    booking_id: input.bookingId,
    doctor_id: input.doctorId,
    amount_cents: input.amountCents,
    credit_amount_cents: input.creditAmountCents,
    commission_cents: input.commissionCents,
    stripe_transfer_id: null,
    status: "pending",
    statement_line: PAID_WITH_WALLET_CREDIT_LINE,
    currency: input.currency.toUpperCase(),
    reversed_cents: 0,
    kind: WALLET_CREDIT_SHARE_KIND,
  };
}

function transferAlreadySent(
  row: WalletCreditTransferRecord
): row is WalletCreditTransferRecord & { stripe_transfer_id: string } {
  return (
    Boolean(row.stripe_transfer_id) &&
    (row.status === "paid" ||
      row.status === "partially_reversed" ||
      row.status === "reversed")
  );
}

/**
 * Insert the pending ledger row, or return the row already stored for
 * this booking. Does not call Stripe. A missing table or failed insert throws.
 */
async function ensurePendingCreditTransfer(
  store: WalletCreditTransferStore,
  input: PayDoctorWalletCreditInput
): Promise<WalletCreditTransferRecord> {
  const existing = await store.findByBookingId(input.bookingId);
  if (existing) return existing;
  try {
    return await store.insert(pendingTransferRow(input));
  } catch (err) {
    const again = await store.findByBookingId(input.bookingId).catch(() => null);
    if (again) return again;
    throw err;
  }
}

/**
 * Transfer the doctor's share of wallet credit once per booking.
 * The ledger row is inserted as pending before Stripe is called. A failed
 * transfer stays pending so a retry uses the same idempotency key.
 * A second call that finds a paid row does not pay again.
 */
export async function payDoctorWalletCreditShare(
  input: PayDoctorWalletCreditInput,
  deps?: WalletCreditDeps
): Promise<
  | { ok: true; transferId: string; alreadyPaid: boolean }
  | { ok: false; error: string }
> {
  if (!input.stripeAccountId) {
    return { ok: false, error: DOCTOR_CARD_PAYMENTS_UNAVAILABLE_MESSAGE };
  }
  if (input.creditAmountCents <= 0 || input.amountCents <= 0) {
    return { ok: false, error: WALLET_CREDIT_PAYOUT_FAILED_MESSAGE };
  }
  if (input.amountCents + input.commissionCents !== input.creditAmountCents) {
    return { ok: false, error: WALLET_CREDIT_PAYOUT_FAILED_MESSAGE };
  }

  const store = storeOf(deps);
  let row: WalletCreditTransferRecord;
  try {
    row = await ensurePendingCreditTransfer(store, input);
  } catch (err) {
    log.error("[wallet-credit] could not record transfer before paying", {
      err,
      bookingId: input.bookingId,
    });
    return { ok: false, error: WALLET_CREDIT_PAYOUT_FAILED_MESSAGE };
  }

  if (transferAlreadySent(row)) {
    return {
      ok: true,
      transferId: row.stripe_transfer_id,
      alreadyPaid: true,
    };
  }

  let created: { transferId: string };
  try {
    created = await createConnectTransfer({
      amountCents: row.amount_cents,
      currency: row.currency,
      destinationAccountId: input.stripeAccountId,
      transferGroup: walletCreditTransferGroup(input.bookingId),
      idempotencyKey: walletCreditShareIdempotencyKey(input.bookingId),
      metadata: {
        booking_id: input.bookingId,
        booking_number: input.bookingNumber,
        credit_amount_cents: String(row.credit_amount_cents),
        commission_cents: String(row.commission_cents),
        kind: WALLET_CREDIT_SHARE_KIND,
      },
      stripe: transferClient(deps),
    });
  } catch (err) {
    log.error("[wallet-credit] doctor share transfer failed; row left pending", {
      err,
      bookingId: input.bookingId,
    });
    return { ok: false, error: WALLET_CREDIT_PAYOUT_FAILED_MESSAGE };
  }

  try {
    await store.update(input.bookingId, {
      status: "paid",
      stripe_transfer_id: created.transferId,
    });
  } catch (err) {
    log.error("[wallet-credit] transfer sent but row still pending", {
      err,
      bookingId: input.bookingId,
      transferId: created.transferId,
    });
  }

  return { ok: true, transferId: created.transferId, alreadyPaid: false };
}

async function bookingWalletAlreadyDebited(bookingId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("wallet_transactions")
    .select("id")
    .eq("target_booking_id", bookingId)
    .eq("type", "debit")
    .limit(1);
  if (error) throw new Error(error.message);
  return Boolean(data && data.length > 0);
}

/**
 * After the card payment succeeds: reserve the ledger row, take the
 * wallet credit once, then transfer the doctor's share. A missing table
 * or failed insert throws before the debit. Safe to run again.
 */
export async function settlePartCreditAfterCardPayment(
  input: {
    patientId: string;
    currency: string;
    bookingId: string;
    bookingNumber: string;
    doctorId: string;
    stripeAccountId: string;
    creditAmountCents: number;
    description: string;
  },
  deps?: WalletCreditDeps
): Promise<{ transferId: string; alreadyPaid: boolean }> {
  if (!input.stripeAccountId) {
    throw new Error(DOCTOR_CARD_PAYMENTS_UNAVAILABLE_MESSAGE);
  }
  const share = walletCreditDoctorShare(input.creditAmountCents);
  const credit: PayDoctorWalletCreditInput = {
    bookingId: input.bookingId,
    bookingNumber: input.bookingNumber,
    doctorId: input.doctorId,
    stripeAccountId: input.stripeAccountId,
    currency: input.currency,
    creditAmountCents: share.creditAmountCents,
    commissionCents: share.commissionCents,
    amountCents: share.amountCents,
  };
  try {
    await ensurePendingCreditTransfer(storeOf(deps), credit);
  } catch (err) {
    log.error("[wallet-credit] part-credit ledger unavailable; wallet not debited", {
      err,
      bookingId: input.bookingId,
    });
    throw new Error(WALLET_CREDIT_PAYOUT_FAILED_MESSAGE);
  }

  const already = deps?.alreadyDebited
    ? await deps.alreadyDebited(input.bookingId)
    : await bookingWalletAlreadyDebited(input.bookingId);
  if (!already) {
    if (deps?.debit) {
      await deps.debit();
    } else {
      await debitWallet({
        patientId: input.patientId,
        currency: input.currency,
        amountCents: input.creditAmountCents,
        sourceType: "refund",
        targetBookingId: input.bookingId,
        description: input.description,
      });
    }
  }

  const paid = await payDoctorWalletCreditShare(credit, deps);
  if (!paid.ok) throw new Error(paid.error);
  return { transferId: paid.transferId, alreadyPaid: paid.alreadyPaid };
}

type AccountsClient = Parameters<typeof doctorCanReceiveConsultCreditPayment>[0];

/**
 * Full-credit confirm path. The ledger row is reserved before any debit.
 * The wallet is debited before the transfer. If the transfer fails, the
 * debit is undone and the booking must not be confirmed. The row stays
 * pending so a retry uses the same idempotency key.
 */
export async function runFullCreditSettlement(
  input: {
    stripeAccountId: string | null | undefined;
    accounts: AccountsClient;
    credit: Omit<PayDoctorWalletCreditInput, "stripeAccountId">;
    debit: () => Promise<void>;
    restoreWallet: () => Promise<void>;
  },
  deps?: WalletCreditDeps
): Promise<
  | { ok: true; transferId: string; alreadyPaid: boolean }
  | { ok: false; error: string }
> {
  if (!input.stripeAccountId) {
    return { ok: false, error: DOCTOR_CARD_PAYMENTS_UNAVAILABLE_MESSAGE };
  }
  const gate = await doctorCanReceiveConsultCreditPayment(
    input.accounts,
    input.stripeAccountId
  );
  if (!gate.ok) return gate;

  const credit: PayDoctorWalletCreditInput = {
    ...input.credit,
    stripeAccountId: input.stripeAccountId,
  };
  const store = storeOf(deps);
  let reserved: WalletCreditTransferRecord;
  try {
    reserved = await ensurePendingCreditTransfer(store, credit);
  } catch (err) {
    log.error("[wallet-credit] full-credit ledger unavailable; wallet not debited", {
      err,
      bookingId: credit.bookingId,
    });
    return { ok: false, error: WALLET_CREDIT_PAYOUT_FAILED_MESSAGE };
  }

  if (transferAlreadySent(reserved)) {
    return {
      ok: true,
      transferId: reserved.stripe_transfer_id,
      alreadyPaid: true,
    };
  }

  try {
    await input.debit();
  } catch (err) {
    log.error("[wallet-credit] full-credit debit failed before transfer", {
      err,
      bookingId: credit.bookingId,
    });
    return { ok: false, error: CREDIT_DEBIT_FAILED_MESSAGE };
  }

  const paid = await payDoctorWalletCreditShare(credit, deps);
  if (!paid.ok) {
    await input.restoreWallet().catch((restoreErr) => {
      log.error("[wallet-credit] could not return wallet credit after transfer failure", {
        err: restoreErr,
        bookingId: credit.bookingId,
      });
    });
    return paid;
  }

  return paid;
}

/**
 * Reverse the credit-share transfer in proportion to the original credit
 * paid (the row's credit_amount_cents), not the credit still outstanding.
 * No row means this booking did not pay the doctor from wallet credit.
 */
export async function reverseDoctorWalletCreditShare(
  input: {
    bookingId: string;
    /** Credit cents this refund returns to the patient. */
    refundedCreditCents: number;
    /**
     * Credit still outstanding before this refund. Callers pass the
     * remaining credit. The proportion uses the transfer row's original
     * credit_amount_cents instead.
     */
    creditOutstandingCents: number;
  },
  deps?: WalletCreditDeps
): Promise<{ reversedCents: number; reversalId?: string }> {
  const store = storeOf(deps);
  let record: WalletCreditTransferRecord | null = null;
  try {
    record = await store.findByBookingId(input.bookingId);
  } catch (err) {
    log.error("[wallet-credit] could not load transfer for reversal", {
      err,
      bookingId: input.bookingId,
    });
    return { reversedCents: 0 };
  }
  if (!record?.stripe_transfer_id) return { reversedCents: 0 };

  const alreadyReversedCents = record.reversed_cents || 0;
  const reversalCents = proportionalCreditTransferReversalCents({
    transferAmountCents: record.amount_cents,
    alreadyReversedCents,
    refundedCreditCents: input.refundedCreditCents,
    originalCreditCents: record.credit_amount_cents,
    creditOutstandingCents: input.creditOutstandingCents,
  });
  if (reversalCents <= 0) return { reversedCents: 0 };

  const cursor = creditRefundCursor({
    originalCreditCents: record.credit_amount_cents,
    creditOutstandingCents: input.creditOutstandingCents,
    refundedCreditCents: input.refundedCreditCents,
  });
  const reversal = await reverseConnectTransfer({
    transferId: record.stripe_transfer_id,
    amountCents: reversalCents,
    metadata: {
      booking_id: input.bookingId,
      kind: "wallet_credit_share_reversal",
      credit_amount_cents: String(record.credit_amount_cents),
      commission_cents: String(record.commission_cents),
    },
    idempotencyKey: walletCreditReversalIdempotencyKey(
      input.bookingId,
      cursor.before,
      cursor.refunded
    ),
    stripe: transferClient(deps),
  });

  const reversedCents = alreadyReversedCents + reversalCents;
  const status: WalletCreditTransferStatus =
    reversedCents >= record.amount_cents ? "reversed" : "partially_reversed";
  await store.update(input.bookingId, {
    reversed_cents: reversedCents,
    status,
  });

  return { reversedCents: reversalCents, reversalId: reversal.reversalId };
}

/** Read the credit-share row. No row means the booking did not pay with credit. */
export async function loadWalletCreditTransfer(
  bookingId: string,
  deps?: WalletCreditDeps
): Promise<WalletCreditTransferRecord | null> {
  return storeOf(deps).findByBookingId(bookingId);
}

/**
 * Refund the card charge (destination reversal + application fee) and
 * reverse the wallet-credit transfer. Card-only bookings have no transfer row.
 * The Stripe refund key is stable for this booking and amount, so a retry
 * returns the original refund.
 */
export async function refundConsultCardAndCreditShare(
  input: {
    paymentIntentId: string | null;
    cardRefundCents: number;
    bookingId: string;
    /** Credit cents this refund returns. */
    refundedCreditCents: number;
    /** Credit still outstanding before this refund. */
    creditOutstandingCents: number;
    alreadyRefundedCents?: number;
  },
  deps?: WalletCreditDeps
): Promise<{ cardRefundId: string | null; reversedCents: number }> {
  let cardRefundId: string | null = null;
  if (input.paymentIntentId && input.cardRefundCents > 0) {
    const stripe =
      deps?.stripe ??
      (getStripe() as unknown as NonNullable<WalletCreditDeps["stripe"]>);
    if (!stripe.refunds) {
      throw new Error("Stripe refunds client is not available");
    }
    const refund = await stripe.refunds.create(
      {
        payment_intent: input.paymentIntentId,
        amount: input.cardRefundCents,
        reverse_transfer: true,
        refund_application_fee: true,
      },
      {
        idempotencyKey: consultCardRefundIdempotencyKey(
          input.bookingId,
          input.cardRefundCents,
          Math.max(0, Math.round(input.alreadyRefundedCents || 0))
        ),
      }
    );
    cardRefundId = refund.id;
  }

  const reversed = await reverseDoctorWalletCreditShare(
    {
      bookingId: input.bookingId,
      refundedCreditCents: input.refundedCreditCents,
      creditOutstandingCents: input.creditOutstandingCents,
    },
    deps
  );

  return { cardRefundId, reversedCents: reversed.reversedCents };
}
