export const BOOKING_STATUSES = {
  PENDING_PAYMENT: "pending_payment",
  CONFIRMED: "confirmed",
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  REJECTED: "rejected",
  COMPLETED: "completed",
  CANCELLED_PATIENT: "cancelled_patient",
  CANCELLED_DOCTOR: "cancelled_doctor",
  NO_SHOW: "no_show",
  REFUNDED: "refunded",
} as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[keyof typeof BOOKING_STATUSES];

export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  "pending_payment",
  "confirmed",
  "pending_approval",
  "approved",
];

export const CANCELLATION_POLICIES = {
  FLEXIBLE: "flexible",
  MODERATE: "moderate",
  STRICT: "strict",
} as const;

export type CancellationPolicy = (typeof CANCELLATION_POLICIES)[keyof typeof CANCELLATION_POLICIES];

export const CONSULTATION_TYPES = {
  IN_PERSON: "in_person",
  VIDEO: "video",
} as const;

export type ConsultationType = (typeof CONSULTATION_TYPES)[keyof typeof CONSULTATION_TYPES];
