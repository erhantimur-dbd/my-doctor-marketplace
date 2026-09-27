export const SECOND_OFFER_ERROR =
  "This account already has an offer. A second offer can't be added.";

export const INVITE_USED_ERROR = "This signup link has already been used.";

export type AttributionAttempt = {
  inviteId: string;
  offerId: string;
  doctorId: string;
};

export type ExistingAttribution = {
  inviteId: string | null;
  offerId: string;
  doctorId: string | null;
};

/**
 * A unique violation is a second offer unless the row already stored is this
 * same invite, offer, and doctor (checkout can be resumed). Anything else
 * stops before Stripe is called.
 */
export function attributionClaimOutcome(input: {
  errorCode: string | null;
  existing: ExistingAttribution | null;
  attempted: AttributionAttempt;
}): { ok: true; alreadyClaimed: boolean } | { ok: false; error: string } {
  if (!input.errorCode) return { ok: true, alreadyClaimed: false };
  if (input.errorCode === "23505") {
    const existing = input.existing;
    const sameInvite =
      existing &&
      existing.inviteId === input.attempted.inviteId &&
      existing.offerId === input.attempted.offerId &&
      existing.doctorId === input.attempted.doctorId;
    if (sameInvite) return { ok: true, alreadyClaimed: true };
    return { ok: false, error: SECOND_OFFER_ERROR };
  }
  return {
    ok: false,
    error: "Could not attach this offer. Checkout was not started.",
  };
}

export function refuseUsedInvite(usedAt: string | null | undefined): string | null {
  if (usedAt) return INVITE_USED_ERROR;
  return null;
}

/** Claim first. Stripe runs only after the database accepts the offer. */
export async function runCheckoutAfterAttributionClaim<T>(input: {
  claim: () => Promise<{ ok: true } | { ok: false; error: string }>;
  createSession: () => Promise<T>;
}): Promise<T> {
  const claimed = await input.claim();
  if (!claimed.ok) {
    throw new Error(claimed.error);
  }
  return input.createSession();
}
