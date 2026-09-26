/**
 * HOOK: specialty benefits email.
 * Marketing is still drafting the copy. Do not send from the invite page.
 * A future sender may call this only after the copy is approved; until then
 * it always refuses.
 */
export function specialtyBenefitsEmailHook(input: {
  specialtySlug: string;
  doctorEmail: string;
  offerId: string;
}): { send: false; reason: "not_drafted" } {
  void input.specialtySlug;
  void input.doctorEmail;
  void input.offerId;
  return { send: false, reason: "not_drafted" };
}

export function assertInviteSendsNoEmail(hook: { send: boolean }): void {
  if (hook.send) {
    throw new Error("Invite page must not send the specialty benefits email.");
  }
}
