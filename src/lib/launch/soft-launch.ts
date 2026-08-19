/**
 * Soft-launch kill-switch.
 *
 * MyDoctors360 is a marketplace (search + booking / video / payments).
 * Prescriptions, care plans, and public clinical chat are unreachable
 * regardless of license tier. `hasFeature("prescriptions")` is not access
 * control here — every linked doctor is professional:active, so a Pro+
 * gate would block nobody.
 *
 * Flip these helpers only when Legal + product explicitly re-enable a
 * surface. Do not invent a new license tier to "unlock" them.
 */

export const PRESCRIPTIONS_DISABLED_MESSAGE =
  "Prescriptions are disabled for this launch";

export const CARE_PLANS_DISABLED_MESSAGE =
  "Care plans are disabled for this launch";

export const PUBLIC_CHAT_DISABLED_MESSAGE = "This assistant is unavailable.";

export const SYMPTOM_ANALYSIS_DISABLED_MESSAGE = "This tool is unavailable.";

export function isPrescriptionsEnabled(): boolean {
  return false;
}

export function isCarePlansEnabled(): boolean {
  return false;
}

export function isPublicChatEnabled(): boolean {
  return false;
}

export function isSymptomAnalysisEnabled(): boolean {
  return false;
}
