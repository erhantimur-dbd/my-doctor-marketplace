import type Stripe from "stripe";

/**
 * Patient-facing copy when a consult charge would otherwise run on the
 * platform merchant account. Never fall back to that charge.
 */
export const DOCTOR_CARD_PAYMENTS_UNAVAILABLE_MESSAGE =
  "This doctor can't take online payments yet. Please try again later.";

/**
 * Express Connect accounts must be able to take cards (merchant of record
 * via on_behalf_of) and receive destination transfers.
 */
export const EXPRESS_CONNECT_CAPABILITIES = {
  card_payments: { requested: true },
  transfers: { requested: true },
} as const satisfies Stripe.AccountCreateParams.Capabilities;

export type CardPaymentsCapabilityStatus =
  | "active"
  | "pending"
  | "inactive"
  | "unknown";

type AccountCapabilities = {
  capabilities?: { card_payments?: string | null } | null;
};

type CardPaymentsStripe = {
  accounts: {
    retrieve(id: string): Promise<AccountCapabilities>;
    update(
      id: string,
      params: {
        capabilities: { card_payments: { requested: true } };
      }
    ): Promise<AccountCapabilities>;
  };
};

export function cardPaymentsCapabilityStatus(
  capabilities: { card_payments?: string | null } | null | undefined
): CardPaymentsCapabilityStatus {
  const status = capabilities?.card_payments;
  if (status === "active" || status === "pending" || status === "inactive") {
    return status;
  }
  return "unknown";
}

export function isCardPaymentsCapabilityActive(
  capabilities: { card_payments?: string | null } | null | undefined
): boolean {
  return cardPaymentsCapabilityStatus(capabilities) === "active";
}

/**
 * Live check against Stripe. Pending, inactive, missing, and retrieve
 * failures all refuse the charge.
 */
export async function doctorCanAcceptConsultCardPayment(
  stripe: Pick<CardPaymentsStripe, "accounts">,
  stripeAccountId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);
    if (isCardPaymentsCapabilityActive(account.capabilities)) {
      return { ok: true };
    }
  } catch {
    // Fail closed. A Stripe outage must not charge under the platform name.
  }
  return { ok: false, error: DOCTOR_CARD_PAYMENTS_UNAVAILABLE_MESSAGE };
}

/**
 * Ask Stripe for card_payments on an account that already exists.
 * Active and pending capabilities are left unchanged. Requesting an
 * already-requested capability is a no-op on Stripe's side; we skip the
 * update entirely in those cases.
 */
export async function requestCardPaymentsIfNeeded(
  stripe: CardPaymentsStripe,
  stripeAccountId: string
): Promise<CardPaymentsCapabilityStatus> {
  const account = await stripe.accounts.retrieve(stripeAccountId);
  const current = cardPaymentsCapabilityStatus(account.capabilities);
  if (current === "active" || current === "pending") return current;

  const updated = await stripe.accounts.update(stripeAccountId, {
    capabilities: { card_payments: { requested: true } },
  });
  return cardPaymentsCapabilityStatus(updated.capabilities);
}
