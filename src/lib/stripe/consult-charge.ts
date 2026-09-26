/**
 * Destination-charge parameters for a patient consult.
 *
 * Normal consult checkout (booking, follow-up, admin payment links) and the
 * clinic reschedule balance all go through this function. Keeping one object
 * means a later change to consult charge parameters lands on the balance
 * charge as well.
 *
 * TODO(#56): Once "Make the doctor the merchant of record on consult
 * payments" lands, set on_behalf_of to destinationAccountId in the object
 * returned here (the same Express account as transfer_data.destination),
 * and keep that PR's card_payments check in front of every caller. Do not
 * set on_behalf_of on a platform charge (subscriptions, licences, wallet,
 * coupons, or any charge that has no connected-account destination).
 */
export function consultDestinationChargeParams(input: {
  destinationAccountId: string;
  applicationFeeCents: number;
}): {
  application_fee_amount: number;
  transfer_data: { destination: string };
} {
  const applicationFeeCents = Math.max(0, Math.round(input.applicationFeeCents));
  return {
    application_fee_amount: applicationFeeCents,
    transfer_data: {
      destination: input.destinationAccountId,
    },
  };
}
