/**
 * Guest and signed-in booking confirmation share one page.
 * Times use the UK appointment window. Cancellation copy uses the policy
 * stored on the booking when present, otherwise the doctor's policy.
 */

import { formatAppointmentWindow } from "@/lib/utils/appointment-window";

export function formatConfirmationAppointmentWindow(input: {
  start: string | Date;
  end?: string | Date | null;
  appointmentDate?: string | null;
}): string {
  return formatAppointmentWindow(input.start, input.end, {
    appointmentDate: input.appointmentDate,
  });
}

const POLICY_DETAIL = {
  flexible: {
    label: "Flexible",
    detailKey: "cancel_policy_flexible_detail",
  },
  moderate: {
    label: "Moderate",
    detailKey: "cancel_policy_moderate_detail",
  },
  strict: {
    label: "Strict",
    detailKey: "cancel_policy_strict_detail",
  },
} as const;

export type ConfirmationCancellationPolicy = keyof typeof POLICY_DETAIL;

export function confirmationCancellationNotice(input: {
  bookingPolicy?: string | null;
  doctorPolicy?: string | null;
}): {
  policy: ConfirmationCancellationPolicy;
  label: string;
  detailKey: (typeof POLICY_DETAIL)[ConfirmationCancellationPolicy]["detailKey"];
} | null {
  const raw = (input.bookingPolicy || input.doctorPolicy || "")
    .trim()
    .toLowerCase();
  if (raw !== "flexible" && raw !== "moderate" && raw !== "strict") {
    return null;
  }
  const copy = POLICY_DETAIL[raw];
  return { policy: raw, label: copy.label, detailKey: copy.detailKey };
}
