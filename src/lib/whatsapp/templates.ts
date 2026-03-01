// WhatsApp template name constants and component builder helpers.
// Template names must match the templates approved in Meta Business Manager.
// All templates use Utility category (non-PHI operational messages only).

// ============================================================
// Template Name Constants
// ============================================================

/** Utility: "Hi {{1}}, reminder: your appointment is {{2}} at {{3}} with Dr. {{4}}. Booking: {{5}}." */
export const TEMPLATE_APPOINTMENT_REMINDER = "appointment_reminder";

/** Utility: "Hi {{1}}, your booking {{2}} is confirmed for {{3}} at {{4}} with Dr. {{5}}. Amount: {{6}}." */
export const TEMPLATE_BOOKING_CONFIRMATION = "booking_confirmation";

/** Utility: "Hi {{1}}, payment of {{2}} received for booking {{3}}. Thank you for choosing MyDoctors360." */
export const TEMPLATE_PAYMENT_RECEIPT = "payment_receipt";

/** Utility: "Hi {{1}}, your booking {{2}} for {{3}} has been cancelled. {{4}}" */
export const TEMPLATE_BOOKING_CANCELLATION = "booking_cancellation";

/** Utility: "Hi {{1}}, your support ticket {{2}} has been updated. Check your dashboard for details." */
export const TEMPLATE_TICKET_UPDATE = "support_ticket_update";

// ============================================================
// Component Builder Helpers
// ============================================================

interface TemplateComponent {
  type: "body" | "header" | "button";
  parameters: Array<{
    type: "text";
    text: string;
  }>;
}

function bodyParams(...texts: string[]): TemplateComponent[] {
  return [
    {
      type: "body",
      parameters: texts.map((text) => ({ type: "text" as const, text })),
    },
  ];
}

/**
 * Map user's preferred locale to WhatsApp template language code.
 * Falls back to "en" if the locale doesn't have a registered template.
 */
export function mapLocaleToWhatsApp(
  locale: string | null | undefined
): string {
  const map: Record<string, string> = {
    en: "en",
    de: "de",
    tr: "tr",
    fr: "fr",
  };
  return map[locale || "en"] || "en";
}

// ============================================================
// Per-Template Component Builders
// ============================================================

export function buildAppointmentReminderComponents(params: {
  patientName: string;
  date: string;
  time: string;
  doctorName: string;
  bookingNumber: string;
}): TemplateComponent[] {
  return bodyParams(
    params.patientName,
    params.date,
    params.time,
    params.doctorName,
    params.bookingNumber
  );
}

export function buildBookingConfirmationComponents(params: {
  patientName: string;
  bookingNumber: string;
  date: string;
  time: string;
  doctorName: string;
  amount: string;
}): TemplateComponent[] {
  return bodyParams(
    params.patientName,
    params.bookingNumber,
    params.date,
    params.time,
    params.doctorName,
    params.amount
  );
}

export function buildPaymentReceiptComponents(params: {
  patientName: string;
  amount: string;
  bookingNumber: string;
}): TemplateComponent[] {
  return bodyParams(
    params.patientName,
    params.amount,
    params.bookingNumber
  );
}

export function buildBookingCancellationComponents(params: {
  patientName: string;
  bookingNumber: string;
  date: string;
  refundInfo: string; // e.g., "A refund of €120 has been initiated." or "No refund applicable."
}): TemplateComponent[] {
  return bodyParams(
    params.patientName,
    params.bookingNumber,
    params.date,
    params.refundInfo
  );
}

export function buildTicketUpdateComponents(params: {
  userName: string;
  ticketNumber: string;
}): TemplateComponent[] {
  return bodyParams(params.userName, params.ticketNumber);
}
