import type Stripe from "stripe";

export type StripeWebhookSecretKind = "platform" | "connect";

export interface StripeWebhookSecretCandidate {
  secret: string;
  kind: StripeWebhookSecretKind;
}

/**
 * Platform secret first, then the Connect endpoint secret.
 * Empty values are omitted. The real signing secrets are never returned
 * to logs by this helper's callers.
 */
export function stripeWebhookSecretCandidates(
  env: Record<string, string | undefined> = process.env
): StripeWebhookSecretCandidate[] {
  const specs: Array<[string, StripeWebhookSecretKind]> = [
    ["STRIPE_WEBHOOK_SECRET", "platform"],
    ["STRIPE_CONNECT_WEBHOOK_SECRET", "connect"],
  ];
  const candidates: StripeWebhookSecretCandidate[] = [];
  for (const [key, kind] of specs) {
    const secret = env[key]?.trim();
    if (secret) candidates.push({ secret, kind });
  }
  return candidates;
}

export type StripeWebhookVerifyFailure = "none_configured" | "all_failed";

export class StripeWebhookVerifyError extends Error {
  readonly failure: StripeWebhookVerifyFailure;

  constructor(failure: StripeWebhookVerifyFailure) {
    super(
      failure === "none_configured"
        ? "no webhook secrets configured"
        : "invalid signature"
    );
    this.name = "StripeWebhookVerifyError";
    this.failure = failure;
  }
}

/**
 * Try each configured signing secret. The first constructEvent success wins.
 * A failing platform secret still allows the Connect secret to verify.
 */
export function verifyStripeWebhookSignature(input: {
  payload: string;
  signature: string;
  secrets: StripeWebhookSecretCandidate[];
  constructEvent: (
    payload: string,
    signature: string,
    secret: string
  ) => Stripe.Event;
}): { event: Stripe.Event; kind: StripeWebhookSecretKind } {
  if (input.secrets.length === 0) {
    throw new StripeWebhookVerifyError("none_configured");
  }

  for (const candidate of input.secrets) {
    try {
      const event = input.constructEvent(
        input.payload,
        input.signature,
        candidate.secret
      );
      return { event, kind: candidate.kind };
    } catch {
      // Try the next secret. Do not attach the secret or the verifier
      // error to anything that gets logged.
    }
  }

  throw new StripeWebhookVerifyError("all_failed");
}
