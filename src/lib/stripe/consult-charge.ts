/**
 * Destination-charge parameters for a patient consult.
 *
 * Booking checkout, follow-up checkout, admin payment links, and the
 * clinic reschedule balance all go through this function. on_behalf_of is
 * the doctor's Express account, the same account as transfer_data.destination,
 * so the doctor is the merchant of record.
 *
 * Callers must run doctorCanAcceptConsultCardPayment first and refuse the
 * charge when card_payments is not active. Do not use this for a platform
 * charge (subscriptions, licences, wallet, coupons, invoices, or any charge
 * with no connected-account destination).
 */
export function consultDestinationChargeParams(input: {
  destinationAccountId: string;
  applicationFeeCents: number;
}): {
  application_fee_amount: number;
  on_behalf_of: string;
  transfer_data: { destination: string };
} {
  const applicationFeeCents = Math.max(0, Math.round(input.applicationFeeCents));
  return {
    application_fee_amount: applicationFeeCents,
    on_behalf_of: input.destinationAccountId,
    transfer_data: {
      destination: input.destinationAccountId,
    },
  };
}
