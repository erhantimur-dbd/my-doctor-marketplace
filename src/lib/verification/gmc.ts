/**
 * GMC (General Medical Council) register verification helpers.
 *
 * Unlike CQC, the GMC does NOT publish a free Syndication API. The Medical
 * Register is searchable at https://www.gmc-uk.org/doctors/register/LRMP.asp
 * but there's no machine-readable endpoint we're allowed to depend on for
 * production verification. The practical approach the industry takes
 * (Doctify, Top Doctors, Babylon) is:
 *
 *   1. Capture the GMC reference number at onboarding.
 *   2. Present an admin a pre-filled link to the GMC register for that
 *      number, so they can do a manual check.
 *   3. Record the manual confirmation + timestamp + reviewer ID in an
 *      audit trail.
 *   4. Re-check on a regular cycle (weekly cron) and escalate if anything
 *      looks off.
 *
 * This module provides the helpers for step 2 and a small number-format
 * validator. The admin-side storage of step 3 lives in
 * `doctor_approval_checklist.gmc_verified` + the audit log.
 */

/**
 * Strict validation for a GMC Reference Number. The GMC issues 7-digit
 * numeric references (historically they were 6-digit, but everything in
 * active circulation today is 7 digits). We accept only 7-digit numeric.
 */
export function isValidGmcReference(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  return /^[0-9]{7}$/.test(value.trim());
}

/**
 * Build a deep link into the GMC Medical Register search that pre-fills the
 * doctor's reference number, so the reviewing admin can confirm in one
 * click. The register UI accepts a `number` query param.
 *
 * We intentionally link to the canonical gmc-uk.org register rather than a
 * deep-linked result, because the GMC register's URL structure is not a
 * stable API and has changed historically.
 */
export function buildGmcRegisterLink(gmcNumber: string | null | undefined): string {
  if (!isValidGmcReference(gmcNumber ?? "")) {
    return "https://www.gmc-uk.org/registration-and-licensing/the-medical-register";
  }
  const num = encodeURIComponent((gmcNumber as string).trim());
  // The GMC register supports a `number` query parameter on the search page
  // that pre-fills the reference number field. This is not a documented
  // contract, so any breakage falls back to the unfiltered search page
  // above — the URL still resolves correctly to the right screen.
  return `https://www.gmc-uk.org/doctors/register/LRMP.asp?gmcref=${num}`;
}

/**
 * Produce the display block an admin sees next to the "GMC Register
 * Verified" checkbox in the approval checklist. Pure data — the UI
 * component is responsible for presentation.
 */
export function buildGmcReviewContext(gmcNumber: string | null | undefined): {
  valid: boolean;
  formattedNumber: string;
  registerLink: string;
  instructions: string;
} {
  const valid = isValidGmcReference(gmcNumber ?? "");
  return {
    valid,
    formattedNumber: valid ? (gmcNumber as string).trim() : "(invalid format)",
    registerLink: buildGmcRegisterLink(gmcNumber),
    instructions: valid
      ? "Click through to the GMC register, confirm the doctor's name, licence to practise, and any conditions or warnings, then tick this box."
      : "The GMC reference is not a 7-digit number. Ask the doctor to re-supply it before ticking this box.",
  };
}
