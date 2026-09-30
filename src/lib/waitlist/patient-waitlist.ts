/**
 * Coming-soon patient waitlist.
 *
 * Reuses launch_notifications (name, email, region). Region "marketplace"
 * is the public-site list, separate from a country launch notification.
 *
 * Details only. Name and email for the launch waitlist.
 * This row does not record a discount.
 */
export const PATIENT_WAITLIST_REGION = "marketplace";

export interface PatientWaitlistRow {
  name: string;
  email: string;
  region: typeof PATIENT_WAITLIST_REGION;
}

export function patientWaitlistRow(input: {
  name: string;
  email: string;
}): PatientWaitlistRow {
  return {
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    region: PATIENT_WAITLIST_REGION,
  };
}
