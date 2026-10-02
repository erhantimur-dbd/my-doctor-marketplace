/**
 * Patient account holders must be 18 or over.
 * The label is legal copy and must stay byte-for-byte identical in every locale.
 */

export const ADULT_CONFIRMATION_LABEL = "I confirm I'm 18 or over.";

export const ADULT_CONFIRMATION_REQUIRED_ERROR =
  "You must confirm you are 18 or over to create a patient account.";

export const PATIENT_TERMS_ELIGIBILITY =
  "You must be 18 or over to create a patient account. A parent or guardian can book for a child under 18 by adding them as a dependent on their own account.";

/** Doctor, admin, and testing-service accounts do not collect this confirmation. */
export function isPatientAccountRole(role: string | null | undefined): boolean {
  return role !== "doctor" && role !== "admin";
}

export function isAdultConfirmed(
  value: FormDataEntryValue | string | boolean | null | undefined
): boolean {
  return value === true || value === "on" || value === "true";
}

export function adultConfirmationError(
  value: FormDataEntryValue | string | boolean | null | undefined
): string | null {
  return isAdultConfirmed(value) ? null : ADULT_CONFIRMATION_REQUIRED_ERROR;
}

/** Service-role profile stamp written at patient account creation. */
export function patientSignupProfileStamp(now: Date = new Date()): {
  terms_accepted_at: string;
  privacy_accepted_at: string;
  adult_confirmed_at: string;
} {
  const iso = now.toISOString();
  return {
    terms_accepted_at: iso,
    privacy_accepted_at: iso,
    adult_confirmed_at: iso,
  };
}

/** Email/password Create Account button. Empty password stays enabled for the native required check. */
export function canSubmitPatientSignup(input: {
  acceptedTerms: boolean;
  adultConfirmed: boolean;
  passwordEnteredOk: boolean;
  loading?: boolean;
}): boolean {
  return (
    input.acceptedTerms &&
    input.adultConfirmed &&
    input.passwordEnteredOk &&
    !input.loading
  );
}
