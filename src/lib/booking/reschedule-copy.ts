/** Shown when a clinic reschedule would move the booking to another clinician. */
export const DOCTOR_CHANGE_RESCHEDULE_MESSAGE =
  "Please cancel and rebook with the other clinician";

/** Clinic and doctor cancellations. Late-cancellation rules apply only to patient cancels. */
export const CLINIC_CANCEL_STATUS = "cancelled_doctor" as const;
