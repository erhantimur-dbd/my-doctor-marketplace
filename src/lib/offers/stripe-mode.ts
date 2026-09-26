export function assertStripeTestSecret(secret: string | undefined | null): void {
  if (!secret || !secret.startsWith("sk_test_")) {
    throw new Error(
      "Subscription offers require a Stripe test secret (sk_test_…). Refusing to call Stripe."
    );
  }
}

export function isStripeTestMode(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"));
}

export function assertStripeTestMode(): void {
  assertStripeTestSecret(process.env.STRIPE_SECRET_KEY);
}
