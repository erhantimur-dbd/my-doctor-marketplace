/**
 * One-line payment-error notices.
 *
 * PAYMENT_ERROR_NOTICES stays off until Legal publishes the terms.
 * Unset, empty, or any value other than "true" or "1" hides the lines.
 * Same opt-in shape as NEXT_PUBLIC_OAUTH_MICROSOFT in oauth-providers.ts.
 * PostHog is not used. This is not an admin setting.
 *
 * The English sentences are the legal source. Locale files copy them
 * verbatim until Legal supplies translations.
 */

export const PATIENT_PAYMENT_ERROR_NOTICE =
  "If a payment or refund goes wrong, we'll contact you to put it right. See Payment errors in our Terms.";

export const DOCTOR_PAYMENT_ERROR_NOTICE =
  "If a payout or refund is made in error, we may correct it from future payouts, as set out in our Doctor terms.";

export const PATIENT_TERMS_HASH = "payment-errors";
export const DOCTOR_TERMS_HASH = "doctor-payment-errors";

export function paymentErrorNoticesEnabled(): boolean {
  const raw = process.env.PAYMENT_ERROR_NOTICES;
  if (raw === undefined || raw === "") return false;
  return raw === "true" || raw === "1";
}

export function termsClausePath(kind: "patient" | "doctor"): string {
  const hash = kind === "patient" ? PATIENT_TERMS_HASH : DOCTOR_TERMS_HASH;
  return `/terms#${hash}`;
}

export function termsClauseUrl(
  origin: string,
  locale: string,
  kind: "patient" | "doctor"
): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/${locale}${termsClausePath(kind)}`;
}

/** Stripe Checkout submit message. Hosted Pay has no HTML link, so the URL is in the text. */
export function checkoutSubmitNotice(
  kind: "patient" | "doctor",
  origin: string,
  locale: string
): { submit: { message: string } } | undefined {
  if (!paymentErrorNoticesEnabled()) return undefined;
  const sentence =
    kind === "patient"
      ? PATIENT_PAYMENT_ERROR_NOTICE
      : DOCTOR_PAYMENT_ERROR_NOTICE;
  return {
    submit: {
      message: `${sentence} ${termsClauseUrl(origin, locale, kind)}`,
    },
  };
}
