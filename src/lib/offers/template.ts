import { formatOfferDate, trialEndFrom } from "@/lib/offers/dates";
import { firstYearPence, formatGbpFromPence } from "@/lib/offers/money";
import type { OfferKind } from "@/lib/offers/plans";

export const OFFER_SMALL_PRINT =
  "For business customers only. One code per account. Can't be combined with Founding Free. No cash value.";

export type OfferCopyInput = {
  kind: OfferKind;
  percentOff: number | null;
  trialDays: number | null;
  redeemBy: Date;
  /** When the trial would start. Invite pages pass "now". */
  trialStartsAt: Date;
  soloFullPence: number;
  proFullPence: number;
};

export type OfferCopy = {
  emphasis: string;
  body: string;
  redeemLine: string;
  smallPrint: string;
  plainText: string;
};

/**
 * One legal-approved template. Prices and dates are filled from offer data.
 * Callers never type per-offer sentences.
 */
export function renderOfferCopy(input: OfferCopyInput): OfferCopy {
  const soloFull = formatGbpFromPence(input.soloFullPence);
  const proFull = formatGbpFromPence(input.proFullPence);
  const redeemLine = `Redeem by ${formatOfferDate(input.redeemBy)}. Prices exclude VAT.`;

  if (input.kind === "percent_first_year") {
    const percent = input.percentOff ?? 0;
    const soloYear1 = formatGbpFromPence(
      firstYearPence(input.soloFullPence, percent)
    );
    const proYear1 = formatGbpFromPence(
      firstYearPence(input.proFullPence, percent)
    );
    const emphasis = `${percent}% off your first year.`;
    const body = `Annual Solo is ${soloYear1} for year one, then renews automatically at ${soloFull} a year unless you cancel. Annual Pro is ${proYear1} for year one, then renews automatically at ${proFull} a year unless you cancel.`;
    return {
      emphasis,
      body,
      redeemLine,
      smallPrint: OFFER_SMALL_PRINT,
      plainText: `${emphasis} ${body} ${redeemLine} ${OFFER_SMALL_PRINT}`,
    };
  }

  const trialEnd = trialEndFrom(input.trialStartsAt, input.trialDays ?? 0);
  const trialEndLabel = formatOfferDate(trialEnd);
  const emphasis = `Free until ${trialEndLabel}.`;
  const body = `We'll charge ${soloFull} (Solo) or ${proFull} (Pro) on ${trialEndLabel} unless you cancel before then. We'll email you 7 days before. Cancel any time in your account.`;
  return {
    emphasis,
    body,
    redeemLine,
    smallPrint: OFFER_SMALL_PRINT,
    plainText: `${emphasis} ${body} ${redeemLine} ${OFFER_SMALL_PRINT}`,
  };
}
