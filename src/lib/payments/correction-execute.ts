import { getStripe } from "@/lib/stripe/client";
import {
  createConnectTransfer,
  reverseConnectTransfer,
} from "@/lib/stripe/transfer-handoff";
import {
  createPlatformRefund,
  refundConsultCardAndCreditShare,
} from "@/lib/stripe/wallet-credit-share";
import { creditWallet, debitWallet } from "@/lib/wallet";

export function correctionReversalIdempotencyKey(
  correctionId: string,
  transferId: string,
  amountCents: number
): string {
  return `payment-correction-reversal-${correctionId}-${transferId}-${amountCents}`;
}

export async function executeTransferReversal(input: {
  correctionId: string;
  transferId: string;
  amountCents: number;
}): Promise<{ reversalId: string }> {
  return reverseConnectTransfer({
    transferId: input.transferId,
    amountCents: input.amountCents,
    idempotencyKey: correctionReversalIdempotencyKey(
      input.correctionId,
      input.transferId,
      input.amountCents
    ),
    metadata: {
      payment_correction_id: input.correctionId,
      kind: "payment_correction_reversal",
    },
  });
}

export async function executePatientCardRefund(input: {
  correctionId: string;
  bookingId: string;
  paymentIntentId: string | null;
  stripeChargeId: string | null;
  amountCents: number;
}): Promise<{ refundId: string | null }> {
  if (input.bookingId) {
    const result = await refundConsultCardAndCreditShare({
      paymentIntentId: input.paymentIntentId,
      stripeChargeId: input.stripeChargeId,
      cardRefundCents: input.amountCents,
      bookingId: input.bookingId,
      refundedCreditCents: 0,
      creditOutstandingCents: 0,
    });
    return { refundId: result.cardRefundId };
  }
  const refund = await createPlatformRefund({
    chargeId: input.stripeChargeId,
    paymentIntentId: input.paymentIntentId,
    amountCents: input.amountCents,
    idempotencyKey: `payment-correction-refund-${input.correctionId}`,
  });
  return { refundId: refund.refundId };
}

export async function executeWalletAdjustment(input: {
  patientId: string;
  currency: string;
  amountCents: number;
  direction: "credit" | "debit";
  bookingId?: string | null;
  description: string;
}): Promise<void> {
  if (input.direction === "credit") {
    await creditWallet({
      patientId: input.patientId,
      currency: input.currency,
      amountCents: input.amountCents,
      sourceType: "payment_correction",
      sourceBookingId: input.bookingId || undefined,
      description: input.description,
    });
    return;
  }
  await debitWallet({
    patientId: input.patientId,
    currency: input.currency,
    amountCents: input.amountCents,
    sourceType: "payment_correction",
    targetBookingId: input.bookingId || undefined,
    description: input.description,
  });
}

export async function executeDoctorTopup(input: {
  correctionId: string;
  amountCents: number;
  currency: string;
  destinationAccountId: string;
}): Promise<{ transferId: string }> {
  return createConnectTransfer({
    amountCents: input.amountCents,
    currency: input.currency,
    destinationAccountId: input.destinationAccountId,
    idempotencyKey: `payment-correction-topup-${input.correctionId}`,
    metadata: {
      payment_correction_id: input.correctionId,
      kind: "payment_correction_topup",
    },
  });
}

export async function executeFoundingInvoiceRefund(input: {
  correctionId: string;
  amountCents: number;
  stripeChargeId?: string | null;
  stripeInvoiceId?: string | null;
}): Promise<{ refundId: string }> {
  const stripe = getStripe();
  let chargeId = input.stripeChargeId || null;
  if (!chargeId && input.stripeInvoiceId) {
    const invoice = await stripe.invoices.retrieve(input.stripeInvoiceId);
    const charge = (
      invoice as unknown as { charge?: string | { id?: string } | null }
    ).charge;
    chargeId = typeof charge === "string" ? charge : charge?.id || null;
  }
  if (!chargeId) {
    throw new Error("This founding invoice has no charge to refund");
  }
  const refund = await createPlatformRefund({
    chargeId,
    amountCents: input.amountCents,
    idempotencyKey: `payment-correction-invoice-refund-${input.correctionId}`,
  });
  return { refundId: refund.refundId };
}
