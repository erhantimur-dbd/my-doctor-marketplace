// Email templates as pure functions returning { subject, html }
// No external React Email dependency needed - uses inline CSS for compatibility

const BRAND_COLOR = "#0284c7";
const BRAND_COLOR_END = "#0d9488"; // teal-600 — gradient end
const BRAND_NAME = "MyDoctors360";

// Inline SVG data URIs for specialty icons (white, works in all email clients)
// Sourced from Lucide icons matching hero-specialty-icons.tsx
const ICON_STETHOSCOPE = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' opacity='0.35'%3E%3Cpath d='M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3'/%3E%3Cpath d='M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4'/%3E%3Ccircle cx='20' cy='10' r='2'/%3E%3C/svg%3E`;
const ICON_HEART = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' opacity='0.35'%3E%3Cpath d='M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'/%3E%3C/svg%3E`;
const ICON_BRAIN = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' opacity='0.35'%3E%3Cpath d='M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z'/%3E%3Cpath d='M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z'/%3E%3Cpath d='M12 5v13'/%3E%3C/svg%3E`;
const ICON_EYE = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' opacity='0.35'%3E%3Cpath d='M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0'/%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3C/svg%3E`;
const ICON_BABY = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' opacity='0.35'%3E%3Cpath d='M9 12h.01'/%3E%3Cpath d='M15 12h.01'/%3E%3Cpath d='M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5'/%3E%3Cpath d='M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1'/%3E%3C/svg%3E`;
const ICON_ACTIVITY = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' opacity='0.35'%3E%3Cpath d='M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2'/%3E%3C/svg%3E`;
const ICON_SHIELD = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' opacity='0.35'%3E%3Cpath d='M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'/%3E%3C/svg%3E`;

// Row of specialty icons for the email header decoration
const SPECIALTY_ICONS_ROW = `
          <tr>
            <td style="background-color: ${BRAND_COLOR}; background: linear-gradient(135deg, ${BRAND_COLOR} 0%, ${BRAND_COLOR_END} 100%); padding: 0 32px 16px; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="padding: 0 6px;"><img src="${ICON_STETHOSCOPE}" alt="" width="20" height="20" style="display: block;" /></td>
                  <td style="padding: 0 6px;"><img src="${ICON_HEART}" alt="" width="20" height="20" style="display: block;" /></td>
                  <td style="padding: 0 6px;"><img src="${ICON_BRAIN}" alt="" width="20" height="20" style="display: block;" /></td>
                  <td style="padding: 0 6px;"><img src="${ICON_EYE}" alt="" width="20" height="20" style="display: block;" /></td>
                  <td style="padding: 0 6px;"><img src="${ICON_BABY}" alt="" width="20" height="20" style="display: block;" /></td>
                  <td style="padding: 0 6px;"><img src="${ICON_ACTIVITY}" alt="" width="20" height="20" style="display: block;" /></td>
                  <td style="padding: 0 6px;"><img src="${ICON_SHIELD}" alt="" width="20" height="20" style="display: block;" /></td>
                </tr>
              </table>
            </td>
          </tr>`;

function baseLayout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${BRAND_NAME}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${BRAND_COLOR}; background: linear-gradient(135deg, ${BRAND_COLOR} 0%, ${BRAND_COLOR_END} 100%); padding: 24px 32px 12px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
                ${BRAND_NAME}
              </h1>
              <p style="margin: 4px 0 0; color: rgba(255, 255, 255, 0.85); font-size: 13px;">
                Where Patients Meet the Right Doctor
              </p>
            </td>
          </tr>
          <!-- Specialty Icons -->
          ${SPECIALTY_ICONS_ROW}
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.6;">
                This email was sent by ${BRAND_NAME}. If you have questions, please contact our support team.
              </p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #9ca3af;">
                &copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function infoRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding: 8px 0; font-size: 14px; color: #6b7280; width: 160px; vertical-align: top;">
        ${label}
      </td>
      <td style="padding: 8px 0; font-size: 14px; color: #111827; font-weight: 500;">
        ${value}
      </td>
    </tr>`;
}

function button(text: string, url?: string): string {
  const href = url || "#";
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px 0;">
      <tr>
        <td style="background-color: ${BRAND_COLOR}; border-radius: 6px;">
          <a href="${href}" target="_blank" style="display: inline-block; padding: 12px 24px; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none;">
            ${text}
          </a>
        </td>
      </tr>
    </table>`;
}

// ---------------------------------------------------------------------------
// Booking Confirmation
// ---------------------------------------------------------------------------

interface BookingConfirmationParams {
  patientName: string;
  doctorName: string;
  date: string;
  time: string;
  consultationType: string;
  bookingNumber: string;
  amount: number;
  currency: string;
  videoRoomUrl?: string | null;
  clinicName?: string | null;
  address?: string | null;
  isDeposit?: boolean;
  depositAmount?: number;
  remainderDue?: number;
  depositType?: string; // 'percentage' | 'flat'
  depositValue?: number; // the percentage or flat value used
}

export function bookingConfirmationEmail({
  patientName,
  doctorName,
  date,
  time,
  consultationType,
  bookingNumber,
  amount,
  currency,
  videoRoomUrl,
  clinicName,
  address,
  isDeposit,
  depositAmount,
  remainderDue,
  depositType,
  depositValue,
}: BookingConfirmationParams): { subject: string; html: string } {
  const subject = `Booking Confirmed - ${bookingNumber}`;

  const videoBlock = videoRoomUrl
    ? `
    <div style="background-color: #eff6ff; border-left: 4px solid ${BRAND_COLOR}; padding: 16px; border-radius: 0 6px 6px 0; margin-bottom: 16px;">
      <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #1e40af;">
        Video Call Information
      </p>
      <p style="margin: 0 0 12px; font-size: 13px; color: #1e40af; line-height: 1.5;">
        Your appointment will take place via video call. Click the button below to join when your appointment begins.
      </p>
      ${button("Join Video Call", videoRoomUrl)}
      <p style="margin: 8px 0 0; font-size: 11px; color: #6b7280; line-height: 1.5; word-break: break-all;">
        Or copy this link: ${videoRoomUrl}
      </p>
    </div>`
    : `
    <div style="background-color: #eff6ff; border-left: 4px solid ${BRAND_COLOR}; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 16px;">
      <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.5;">
        Please arrive 5 minutes before your scheduled time.${address ? ` Your appointment is at <strong>${address}</strong>.` : ""} If you need to reschedule or cancel, please do so at least 24 hours in advance.
      </p>
    </div>`;

  const depositDescription = depositType === "percentage" && depositValue
    ? `a ${depositValue}% deposit`
    : "a deposit";

  const depositBlock = isDeposit && depositAmount != null && remainderDue != null
    ? `
    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 16px;">
      <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #92400e;">
        Deposit Payment
      </p>
      <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.6;">
        You paid ${depositDescription} of <strong>${currency} ${depositAmount.toFixed(2)}</strong> to secure your appointment.
        The remaining <strong>${currency} ${remainderDue.toFixed(2)}</strong> is payable directly to the doctor on the day of your appointment.
      </p>
      <p style="margin: 8px 0 0; font-size: 12px; color: #a16207; line-height: 1.5;">
        Deposits are fully refundable if cancelled within the cancellation period.
      </p>
    </div>`
    : "";

  const paymentLabel = isDeposit ? "Deposit Paid" : "Amount Paid";
  const paymentAmount = isDeposit && depositAmount != null
    ? `${currency} ${depositAmount.toFixed(2)}`
    : `${currency} ${amount.toFixed(2)}`;

  const html = baseLayout(`
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827;">Booking Confirmed</h2>
    <p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.6;">
      Hi ${patientName}, your appointment has been confirmed and payment received. Here are your booking details:
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${infoRow("Booking Number", bookingNumber)}
            ${infoRow("Doctor", `Dr. ${doctorName}`)}
            ${infoRow("Date", date)}
            ${infoRow("Time", time)}
            ${infoRow("Consultation", consultationType)}
            ${!videoRoomUrl && clinicName ? infoRow("Location", `${clinicName}${address ? `, ${address}` : ""}`) : ""}
            ${infoRow(paymentLabel, paymentAmount)}
            ${isDeposit && remainderDue != null ? infoRow("Due on the Day", `${currency} ${remainderDue.toFixed(2)}`) : ""}
          </table>
        </td>
      </tr>
    </table>

    ${depositBlock}
    ${videoBlock}

    ${button("View Booking Details")}
  `);

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Booking Cancellation
// ---------------------------------------------------------------------------

interface BookingCancellationParams {
  patientName: string;
  doctorName: string;
  date: string;
  time: string;
  bookingNumber: string;
  refundAmount: number;
  currency: string;
  isDeposit?: boolean;
}

export function bookingCancellationEmail({
  patientName,
  doctorName,
  date,
  time,
  bookingNumber,
  refundAmount,
  currency,
  isDeposit,
}: BookingCancellationParams): { subject: string; html: string } {
  const subject = `Booking Cancelled - ${bookingNumber}`;

  const html = baseLayout(`
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827;">Booking Cancelled</h2>
    <p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.6;">
      Hi ${patientName}, your appointment has been cancelled. Here are the details:
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${infoRow("Booking Number", bookingNumber)}
            ${infoRow("Doctor", `Dr. ${doctorName}`)}
            ${infoRow("Date", date)}
            ${infoRow("Time", time)}
            ${infoRow("Refund Amount", `${currency} ${refundAmount.toFixed(2)}`)}
          </table>
        </td>
      </tr>
    </table>

    ${refundAmount > 0
      ? `<div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 16px;">
          <p style="margin: 0; font-size: 13px; color: #166534; line-height: 1.5;">
            A refund of <strong>${currency} ${refundAmount.toFixed(2)}</strong>${isDeposit ? " (deposit)" : ""} will be processed to your original payment method within 5-10 business days.
          </p>
        </div>`
      : `<div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 16px;">
          <p style="margin: 0; font-size: 13px; color: #991b1b; line-height: 1.5;">
            ${isDeposit
              ? "Your deposit is non-refundable as this cancellation is outside the cancellation period."
              : "This cancellation is not eligible for a refund based on our cancellation policy."}
          </p>
        </div>`
    }

    <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">
      If you would like to book a new appointment, please visit our platform.
    </p>

    ${button("Book New Appointment")}
  `);

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Booking Reminder (24h before)
// ---------------------------------------------------------------------------

interface BookingReminderParams {
  patientName: string;
  doctorName: string;
  date: string;
  time: string;
  consultationType: string;
  bookingNumber: string;
  videoRoomUrl?: string | null;
  minutesBefore?: number;
  clinicName?: string | null;
  address?: string | null;
}

export function bookingReminderEmail({
  patientName,
  doctorName,
  date,
  time,
  consultationType,
  bookingNumber,
  videoRoomUrl,
  minutesBefore,
  clinicName,
  address,
}: BookingReminderParams): { subject: string; html: string } {
  // Dynamic subject line based on how far before the appointment
  let timeLabel = "Tomorrow";
  if (minutesBefore !== undefined) {
    if (minutesBefore <= 60) timeLabel = `in ${minutesBefore} minutes`;
    else if (minutesBefore <= 120) timeLabel = "in 2 hours";
    else if (minutesBefore < 1440) timeLabel = `in ${Math.round(minutesBefore / 60)} hours`;
    else if (minutesBefore >= 2880) timeLabel = `in ${Math.round(minutesBefore / 1440)} days`;
  }
  const subject = `Appointment Reminder - ${timeLabel} with Dr. ${doctorName}`;

  const videoBlock = videoRoomUrl
    ? `
    <div style="background-color: #eff6ff; border-left: 4px solid ${BRAND_COLOR}; padding: 16px; border-radius: 0 6px 6px 0; margin-bottom: 16px;">
      <p style="margin: 0 0 8px; font-size: 14px; font-weight: 600; color: #1e40af;">
        Join Your Video Call
      </p>
      <p style="margin: 0 0 12px; font-size: 13px; color: #1e40af; line-height: 1.5;">
        Your appointment is via video call. Click below to join when it's time.
      </p>
      ${button("Join Video Call", videoRoomUrl)}
      <p style="margin: 8px 0 0; font-size: 11px; color: #6b7280; line-height: 1.5; word-break: break-all;">
        Or copy this link: ${videoRoomUrl}
      </p>
    </div>`
    : "";

  const html = baseLayout(`
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827;">Appointment Reminder</h2>
    <p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.6;">
      Hi ${patientName}, this is a friendly reminder that your appointment is coming up ${timeLabel.toLowerCase()}.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${infoRow("Booking Number", bookingNumber)}
            ${infoRow("Doctor", `Dr. ${doctorName}`)}
            ${infoRow("Date", date)}
            ${infoRow("Time", time)}
            ${infoRow("Consultation", consultationType)}
            ${!videoRoomUrl && clinicName ? infoRow("Location", `${clinicName}${address ? `, ${address}` : ""}`) : ""}
          </table>
        </td>
      </tr>
    </table>

    ${videoBlock}

    <div style="background-color: #eff6ff; border-left: 4px solid ${BRAND_COLOR}; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 16px;">
      <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.5;">
        <strong>Preparation Tips:</strong><br />
        &bull; Have your medical records or previous reports ready if applicable.<br />
        &bull; Prepare a list of questions or symptoms you want to discuss.<br />
        ${videoRoomUrl ? "&bull; Ensure you have a stable internet connection and a working camera/microphone." : `&bull; Please arrive 5 minutes before your scheduled time.${address ? ` Your appointment is at ${address}.` : ""}`}
      </p>
    </div>

    ${button("View Booking Details")}
  `);

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Welcome Email
// ---------------------------------------------------------------------------

interface WelcomeEmailParams {
  name: string;
}

export function welcomeEmail({
  name,
}: WelcomeEmailParams): { subject: string; html: string } {
  const subject = `Welcome to ${BRAND_NAME}!`;

  const html = baseLayout(`
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827;">Welcome to ${BRAND_NAME}!</h2>
    <p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.6;">
      Hi ${name}, thank you for joining ${BRAND_NAME}. We are glad to have you on board.
    </p>

    <p style="margin: 0 0 16px; font-size: 14px; color: #374151; line-height: 1.6;">
      Here is what you can do on ${BRAND_NAME}:
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
      <tr>
        <td style="padding: 12px 16px; background-color: #f9fafb; border-radius: 6px; margin-bottom: 8px;">
          <p style="margin: 0; font-size: 14px; color: #111827;">
            <strong style="color: ${BRAND_COLOR};">1.</strong>&nbsp; Browse and discover verified doctors across specialties
          </p>
        </td>
      </tr>
      <tr><td style="height: 8px;"></td></tr>
      <tr>
        <td style="padding: 12px 16px; background-color: #f9fafb; border-radius: 6px;">
          <p style="margin: 0; font-size: 14px; color: #111827;">
            <strong style="color: ${BRAND_COLOR};">2.</strong>&nbsp; Book appointments online with flexible scheduling
          </p>
        </td>
      </tr>
      <tr><td style="height: 8px;"></td></tr>
      <tr>
        <td style="padding: 12px 16px; background-color: #f9fafb; border-radius: 6px;">
          <p style="margin: 0; font-size: 14px; color: #111827;">
            <strong style="color: ${BRAND_COLOR};">3.</strong>&nbsp; Choose between in-person, video, or phone consultations
          </p>
        </td>
      </tr>
      <tr><td style="height: 8px;"></td></tr>
      <tr>
        <td style="padding: 12px 16px; background-color: #f9fafb; border-radius: 6px;">
          <p style="margin: 0; font-size: 14px; color: #111827;">
            <strong style="color: ${BRAND_COLOR};">4.</strong>&nbsp; Read reviews from other patients to make informed decisions
          </p>
        </td>
      </tr>
    </table>

    ${button("Explore Doctors")}

    <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
      If you have any questions, our support team is always here to help.
    </p>
  `);

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Doctor Verified Email
// ---------------------------------------------------------------------------

interface DoctorVerifiedParams {
  doctorName: string;
}

export function doctorVerifiedEmail({
  doctorName,
}: DoctorVerifiedParams): { subject: string; html: string } {
  const subject = `Congratulations! Your ${BRAND_NAME} Profile is Verified`;

  const html = baseLayout(`
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827;">Profile Verified</h2>
    <p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.6;">
      Congratulations Dr. ${doctorName}, your profile has been reviewed and verified by our team. You are now visible to patients on ${BRAND_NAME}.
    </p>

    <div style="background-color: #f0fdf4; border-left: 4px solid #16a34a; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 13px; color: #166534; line-height: 1.5;">
        <strong>Your profile is now live!</strong> Patients can find you, view your availability, and book appointments.
      </p>
    </div>

    <p style="margin: 0 0 16px; font-size: 14px; color: #374151; line-height: 1.6;">
      Here are some next steps to get started:
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
      <tr>
        <td style="padding: 12px 16px; background-color: #f9fafb; border-radius: 6px;">
          <p style="margin: 0; font-size: 14px; color: #111827;">
            &bull;&nbsp; Set up your availability schedule so patients can book with you
          </p>
        </td>
      </tr>
      <tr><td style="height: 8px;"></td></tr>
      <tr>
        <td style="padding: 12px 16px; background-color: #f9fafb; border-radius: 6px;">
          <p style="margin: 0; font-size: 14px; color: #111827;">
            &bull;&nbsp; Complete your profile with a detailed bio and specializations
          </p>
        </td>
      </tr>
      <tr><td style="height: 8px;"></td></tr>
      <tr>
        <td style="padding: 12px 16px; background-color: #f9fafb; border-radius: 6px;">
          <p style="margin: 0; font-size: 14px; color: #111827;">
            &bull;&nbsp; Set your consultation fees and preferred consultation types
          </p>
        </td>
      </tr>
    </table>

    ${button("Go to Dashboard")}
  `);

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Doctor Verification Rejected Email
// ---------------------------------------------------------------------------

interface DoctorRejectedParams {
  doctorName: string;
}

export function doctorRejectedEmail({
  doctorName,
}: DoctorRejectedParams): { subject: string; html: string } {
  const subject = `${BRAND_NAME} — Account Verification Update`;

  const html = baseLayout(`
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827;">Verification Update</h2>
    <p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.6;">
      Dear Dr. ${doctorName}, we were unable to verify your GMC registration with the details provided.
    </p>

    <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 13px; color: #991b1b; line-height: 1.5;">
        <strong>Your account has not been approved.</strong> This may be due to an incorrect GMC reference number or your details not matching the GMC register.
      </p>
    </div>

    <p style="margin: 0 0 16px; font-size: 14px; color: #374151; line-height: 1.6;">
      If you believe this is an error, please contact our support team with your correct GMC reference number and we will review your application again.
    </p>

    ${button("Contact Support")}
  `);

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Review Received Email
// ---------------------------------------------------------------------------

interface ReviewReceivedParams {
  doctorName: string;
  patientName: string;
  rating: number;
}

export function reviewReceivedEmail({
  doctorName,
  patientName,
  rating,
}: ReviewReceivedParams): { subject: string; html: string } {
  const subject = `New Review Received - ${rating} Star${rating !== 1 ? "s" : ""}`;

  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);

  const html = baseLayout(`
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827;">New Patient Review</h2>
    <p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.6;">
      Hi Dr. ${doctorName}, you have received a new review from a patient.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 24px; text-align: center;">
          <p style="margin: 0 0 8px; font-size: 32px; letter-spacing: 4px; color: #f59e0b;">
            ${stars}
          </p>
          <p style="margin: 0 0 4px; font-size: 16px; font-weight: 600; color: #111827;">
            ${rating} out of 5
          </p>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">
            Review by ${patientName}
          </p>
        </td>
      </tr>
    </table>

    <p style="margin: 0 0 16px; font-size: 14px; color: #374151; line-height: 1.6;">
      Patient reviews help build your reputation and attract new patients. Thank you for providing excellent care!
    </p>

    ${button("View All Reviews")}
  `);

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Doctor Referral Invitation Email
// ---------------------------------------------------------------------------

interface DoctorReferralInvitationParams {
  referrerName: string;
  colleagueName: string;
  referralCode: string;
  signUpUrl: string;
}

export function doctorReferralInvitationEmail({
  referrerName,
  colleagueName,
  referralCode,
  signUpUrl,
}: DoctorReferralInvitationParams): { subject: string; html: string } {
  const subject = `${referrerName} invited you to join ${BRAND_NAME} — Get 1 Month Free`;

  const usps = [
    {
      icon: "&#x2705;",
      title: "Verified Profile",
      desc: "Build trust with a credential-verified doctor badge",
    },
    {
      icon: "&#x1F4C5;",
      title: "Instant Booking",
      desc: "Patients book directly from your real-time calendar, 24/7",
    },
    {
      icon: "&#x1F514;",
      title: "Smart Reminders",
      desc: "Reduce no-shows with automated email, SMS &amp; WhatsApp alerts",
    },
    {
      icon: "&#x1F4B3;",
      title: "Secure Payments",
      desc: "Stripe-powered payments deposited directly to your bank",
    },
    {
      icon: "&#x1F310;",
      title: "Multi-Language",
      desc: "Reach patients across Europe in 9+ languages",
    },
    {
      icon: "&#x1F4CA;",
      title: "Revenue Analytics",
      desc: "Track your earnings, bookings &amp; practice growth",
    },
  ];

  const uspRows = [];
  for (let i = 0; i < usps.length; i += 2) {
    const left = usps[i];
    const right = usps[i + 1];
    uspRows.push(`
      <tr>
        <td style="padding: 8px; width: 50%; vertical-align: top;">
          <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px;">
            <p style="margin: 0 0 4px; font-size: 20px;">${left.icon}</p>
            <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #111827;">${left.title}</p>
            <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">${left.desc}</p>
          </div>
        </td>
        ${right ? `
        <td style="padding: 8px; width: 50%; vertical-align: top;">
          <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px;">
            <p style="margin: 0 0 4px; font-size: 20px;">${right.icon}</p>
            <p style="margin: 0 0 4px; font-size: 14px; font-weight: 600; color: #111827;">${right.title}</p>
            <p style="margin: 0; font-size: 12px; color: #6b7280; line-height: 1.5;">${right.desc}</p>
          </div>
        </td>` : "<td></td>"}
      </tr>`);
  }

  const html = baseLayout(`
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827;">You've Been Invited!</h2>
    <p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.6;">
      Hi${colleagueName ? ` ${colleagueName}` : ""}, your colleague <strong>${referrerName}</strong> thinks you'd be a great fit for ${BRAND_NAME} — the trusted marketplace connecting private doctors with patients across Europe.
    </p>

    <!-- 1 Month Free Offer Banner -->
    <div style="background: linear-gradient(135deg, #059669, #0d9488); border-radius: 10px; padding: 24px; margin-bottom: 24px; text-align: center;">
      <p style="margin: 0 0 4px; font-size: 28px;">&#x1F381;</p>
      <p style="margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #ffffff;">
        Get 1 Month Free
      </p>
      <p style="margin: 0; font-size: 14px; color: rgba(255, 255, 255, 0.9); line-height: 1.5;">
        As a special invitation from your colleague, enjoy your first month on ${BRAND_NAME} completely free. Plus, ${referrerName} gets a free month too!
      </p>
    </div>

    <!-- Why Doctors Choose MyDoctors360 -->
    <p style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #111827;">
      Why Doctors Choose ${BRAND_NAME}
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
      ${uspRows.join("")}
    </table>

    <!-- CTA Button -->
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 24px auto;" align="center">
      <tr>
        <td style="background: linear-gradient(135deg, #2563EB, #1d4ed8); border-radius: 8px;">
          <a href="${signUpUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; color: #ffffff; font-size: 15px; font-weight: 700; text-decoration: none;">
            Join ${BRAND_NAME} &mdash; Get 1 Month Free &rarr;
          </a>
        </td>
      </tr>
    </table>

    <!-- Referral Code Box -->
    <div style="background-color: #f0f9ff; border: 2px dashed #93c5fd; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center;">
      <p style="margin: 0 0 4px; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">
        Your Referral Code
      </p>
      <p style="margin: 0; font-size: 24px; font-weight: 700; color: ${BRAND_COLOR}; letter-spacing: 3px;">
        ${referralCode}
      </p>
      <p style="margin: 8px 0 0; font-size: 12px; color: #6b7280;">
        Enter this code during sign-up or use the button above
      </p>
    </div>

    <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center;">
      This invitation expires in 90 days. Offer valid for new doctor accounts only.
    </p>
  `);

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Referral Reward Notification Email
// ---------------------------------------------------------------------------

interface ReferralRewardParams {
  doctorName: string;
  referredDoctorName: string;
}

export function referralRewardEmail({
  doctorName,
  referredDoctorName,
}: ReferralRewardParams): { subject: string; html: string } {
  const subject = `Your colleague joined ${BRAND_NAME} — You earned 1 month free!`;

  const html = baseLayout(`
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827;">Referral Reward Earned!</h2>
    <p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.6;">
      Great news, Dr. ${doctorName}! Your colleague <strong>${referredDoctorName}</strong> has joined ${BRAND_NAME} and subscribed to a plan.
    </p>

    <div style="background: linear-gradient(135deg, #059669, #0d9488); border-radius: 10px; padding: 24px; margin-bottom: 24px; text-align: center;">
      <p style="margin: 0 0 4px; font-size: 28px;">&#x1F389;</p>
      <p style="margin: 0 0 8px; font-size: 18px; font-weight: 700; color: #ffffff;">
        1 Month Free Applied!
      </p>
      <p style="margin: 0; font-size: 14px; color: rgba(255, 255, 255, 0.9); line-height: 1.5;">
        Your reward of one free month has been applied to your subscription. Keep referring colleagues to earn more!
      </p>
    </div>

    ${button("View Your Referrals")}

    <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
      Thank you for spreading the word about ${BRAND_NAME}. Every referral helps build a better healthcare community.
    </p>
  `);

  return { subject, html };
}

// ============================================================
// Support Ticket Emails
// ============================================================

export function supportTicketCreatedEmail(params: {
  userName: string;
  ticketNumber: string;
  category: string;
  ticketSubject: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  const subject = `Support Ticket Created — #${params.ticketNumber}`;

  const categoryLabel =
    params.category.charAt(0).toUpperCase() + params.category.slice(1);

  const html = baseLayout(`
    <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #111827;">
      Support Ticket Created
    </h2>
    <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280;">
      Hi ${params.userName}, we've received your support request and will get back to you shortly.
    </p>

    <div style="background-color: #f0f9ff; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Ticket Number", `#${params.ticketNumber}`)}
        ${infoRow("Category", categoryLabel)}
        ${infoRow("Subject", params.ticketSubject)}
        ${infoRow("Status", "Open")}
      </table>
    </div>

    <div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 14px; color: #854d0e; font-weight: 500;">
        We typically respond within 24 hours
      </p>
      <p style="margin: 6px 0 0; font-size: 13px; color: #a16207;">
        You can track the status and reply to your ticket from your dashboard at any time.
      </p>
    </div>

    ${button("View Ticket", params.dashboardUrl)}

    <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
      If your issue is urgent, you can also reach us via WhatsApp or email at support@mydoctors360.com.
    </p>
  `);

  return { subject, html };
}

export function supportTicketReplyEmail(params: {
  userName: string;
  ticketNumber: string;
  replyPreview: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  const subject = `New Reply on Ticket #${params.ticketNumber}`;

  const html = baseLayout(`
    <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #111827;">
      New Reply on Your Ticket
    </h2>
    <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280;">
      Hi ${params.userName}, our support team has replied to your ticket #${params.ticketNumber}.
    </p>

    <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
        Reply Preview
      </p>
      <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6;">
        ${params.replyPreview}${params.replyPreview.length >= 200 ? "..." : ""}
      </p>
    </div>

    ${button("View Full Conversation", params.dashboardUrl)}

    <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
      You can reply directly from your dashboard to continue the conversation.
    </p>
  `);

  return { subject, html };
}

export function supportTicketResolvedEmail(params: {
  userName: string;
  ticketNumber: string;
  ticketSubject: string;
  dashboardUrl: string;
}): { subject: string; html: string } {
  const subject = `Ticket Resolved — #${params.ticketNumber}`;

  const html = baseLayout(`
    <h2 style="margin: 0 0 8px; font-size: 20px; font-weight: 600; color: #111827;">
      Your Ticket Has Been Resolved
    </h2>
    <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280;">
      Hi ${params.userName}, your support ticket has been marked as resolved.
    </p>

    <div style="background-color: #f0fdf4; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Ticket Number", `#${params.ticketNumber}`)}
        ${infoRow("Subject", params.ticketSubject)}
        ${infoRow("Status", "Resolved")}
      </table>
    </div>

    <p style="margin: 0 0 24px; font-size: 14px; color: #374151; line-height: 1.6;">
      If you still need help or the issue persists, you can reply to your ticket to reopen it, or create a new support ticket.
    </p>

    ${button("View Ticket", params.dashboardUrl)}

    <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
      Thank you for using ${BRAND_NAME}. We're here to help whenever you need us.
    </p>
  `);

  return { subject, html };
}

/* ------------------------------------------------------------------ */
/*  Contact Inquiry — Admin Notification                              */
/* ------------------------------------------------------------------ */
export function contactInquiryAdminEmail(params: {
  name: string;
  email: string;
  inquiryType: string;
  message: string;
}): { subject: string; html: string } {
  const typeLabels: Record<string, string> = {
    doctor_onboarding: "Doctor Onboarding",
    partnership: "Partnership",
    press: "Press & Media",
    general: "General Inquiry",
  };

  const typeLabel = typeLabels[params.inquiryType] || params.inquiryType;
  const subject = `New Contact Inquiry — ${typeLabel}`;

  const html = baseLayout(`
    <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #111827;">
      New Contact Form Inquiry
    </h2>
    <p style="margin: 0 0 24px; font-size: 14px; color: #6b7280;">
      A new inquiry has been submitted through the contact page.
    </p>

    <div style="background-color: #f0f9ff; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Name", params.name)}
        ${infoRow("Email", params.email)}
        ${infoRow("Type", typeLabel)}
      </table>
    </div>

    <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">
        Message
      </p>
      <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6; white-space: pre-wrap;">
        ${params.message}
      </p>
    </div>

    ${button("Reply to Sender", `mailto:${params.email}?subject=Re: Your ${BRAND_NAME} Inquiry`)}
  `);

  return { subject, html };
}

/* ------------------------------------------------------------------ */
/*  Contact Inquiry — Auto-Reply to Sender                            */
/* ------------------------------------------------------------------ */
export function contactInquiryAutoReplyEmail(params: {
  name: string;
  inquiryType: string;
}): { subject: string; html: string } {
  const subject = `We've Received Your Inquiry — ${BRAND_NAME}`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com";

  const html = baseLayout(`
    <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #111827;">
      Thank You for Reaching Out
    </h2>
    <p style="margin: 0 0 24px; font-size: 14px; color: #374151; line-height: 1.6;">
      Hi ${params.name}, thank you for contacting ${BRAND_NAME}. We've received your
      inquiry and our team will get back to you shortly.
    </p>

    <div style="background-color: #fefce8; border-left: 4px solid #eab308; padding: 16px; border-radius: 0 8px 8px 0; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 14px; color: #854d0e;">
        We typically respond within 24 hours during business days (Mon–Fri, 9:00–18:00 CET).
      </p>
    </div>

    <p style="margin: 0 0 24px; font-size: 14px; color: #374151; line-height: 1.6;">
      In the meantime, you might find these helpful:
    </p>

    ${button("View Pricing Plans", `${appUrl}/en/pricing`)}

    <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
      If you're interested in joining as a doctor, you can
      <a href="${appUrl}/en/register-doctor" style="color: ${BRAND_COLOR}; text-decoration: underline;">start your registration</a>
      right away — it only takes a few minutes.
    </p>
  `);

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Admin Message to User
// ---------------------------------------------------------------------------

interface AdminMessageEmailParams {
  recipientName: string;
  subject: string;
  message: string;
}

export function adminMessageEmail({
  recipientName,
  subject,
  message,
}: AdminMessageEmailParams): { subject: string; html: string } {
  const html = baseLayout(`
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827;">Message from ${BRAND_NAME} Admin</h2>
    <p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.6;">
      Hi ${recipientName || "there"},
    </p>

    <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px; border: 1px solid #e5e7eb;">
      <p style="margin: 0 0 8px; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
        ${subject}
      </p>
      <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6; white-space: pre-wrap;">${message}</p>
    </div>

    <p style="margin: 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
      If you have any questions, please reply to this email or contact us through the platform.
    </p>
  `);

  return { subject: `[${BRAND_NAME}] ${subject}`, html };
}

// ---------------------------------------------------------------------------
// Subscription Upgrade Invite
// ---------------------------------------------------------------------------

interface SubscriptionUpgradeInviteParams {
  doctorName: string;
  subscriptionUrl: string;
}

export function subscriptionUpgradeInviteEmail({
  doctorName,
  subscriptionUrl,
}: SubscriptionUpgradeInviteParams): { subject: string; html: string } {
  const subject = `Upgrade to Professional — Grow Your Practice with ${BRAND_NAME}`;

  const features = [
    "Online booking calendar with real-time availability",
    "Unlimited patient bookings",
    "Email, SMS & WhatsApp appointment reminders",
    "Video consultations",
    "Basic & advanced analytics dashboard",
    "Patient CRM",
    "Priority support",
  ];

  const featureList = features
    .map(
      (f) =>
        `<li style="padding: 6px 0; font-size: 14px; color: #374151;">
          <span style="color: #059669; font-weight: 600;">&#10003;</span>&nbsp; ${f}
        </li>`
    )
    .join("");

  const html = baseLayout(`
    <h2 style="margin: 0 0 16px; font-size: 20px; color: #111827; font-weight: 700;">
      Upgrade to Professional and Grow Your Practice
    </h2>

    <p style="margin: 0 0 20px; font-size: 14px; color: #374151; line-height: 1.6;">
      Hi Dr. ${doctorName},
    </p>

    <p style="margin: 0 0 20px; font-size: 14px; color: #374151; line-height: 1.6;">
      You're currently on the <strong>Free</strong> plan, which gives you a public doctor profile on ${BRAND_NAME}. Upgrade to <strong>Professional</strong> to unlock the full suite of tools to manage your practice and reach more patients.
    </p>

    <div style="background-color: #f0fdf4; border-left: 4px solid #059669; padding: 16px 20px; border-radius: 4px; margin: 0 0 24px;">
      <p style="margin: 0; font-size: 15px; color: #065f46; font-weight: 600;">
        Professional Plan &mdash; &euro;99/month
      </p>
      <p style="margin: 4px 0 0; font-size: 13px; color: #047857;">
        Introductory pricing &middot; Lock in your rate today
      </p>
    </div>

    <p style="margin: 0 0 12px; font-size: 14px; color: #374151; font-weight: 600;">
      What's included:
    </p>
    <ul style="margin: 0 0 24px; padding-left: 16px; list-style: none;">
      ${featureList}
    </ul>

    ${button("Upgrade to Professional", subscriptionUrl)}

    <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
      If you have any questions about the Professional plan, our team is here to help. Simply reply to this email or contact us through the platform.
    </p>
  `);

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Treatment Plan
// ---------------------------------------------------------------------------

interface TreatmentPlanParams {
  patientName: string;
  doctorName: string;
  planTitle: string;
  description: string | null;
  totalSessions: number;
  unitPrice: string;
  discount: string | null;
  totalPrice: string;
  paymentType: string;
  doctorNote: string | null;
  planUrl: string;
  expiresAt: string;
}

export function treatmentPlanEmail({
  patientName,
  doctorName,
  planTitle,
  description,
  totalSessions,
  unitPrice,
  discount,
  totalPrice,
  paymentType,
  doctorNote,
  planUrl,
  expiresAt,
}: TreatmentPlanParams): { subject: string; html: string } {
  const subject = `Treatment Plan from ${doctorName} — ${planTitle}`;

  const noteBlock = doctorNote
    ? `
    <div style="background-color: #eff6ff; border-left: 4px solid ${BRAND_COLOR}; padding: 16px 20px; border-radius: 4px; margin: 0 0 24px;">
      <p style="margin: 0 0 4px; font-size: 13px; color: #6b7280; font-weight: 600;">
        Note from ${doctorName}:
      </p>
      <p style="margin: 0; font-size: 14px; color: #1e3a5f; line-height: 1.6; font-style: italic;">
        &ldquo;${doctorNote}&rdquo;
      </p>
    </div>`
    : "";

  const descriptionBlock = description
    ? `<p style="margin: 0 0 20px; font-size: 14px; color: #374151; line-height: 1.6;">
        ${description}
      </p>`
    : "";

  const discountRow = discount
    ? infoRow("Discount", `<span style="color: #059669;">-${discount}</span>`)
    : "";

  const paymentLabel =
    paymentType === "pay_per_visit" ? "Pay Per Visit" : "Pay in Full";

  const html = baseLayout(`
    <h2 style="margin: 0 0 16px; font-size: 20px; color: #111827; font-weight: 700;">
      New Treatment Plan
    </h2>

    <p style="margin: 0 0 20px; font-size: 14px; color: #374151; line-height: 1.6;">
      Hi ${patientName},
    </p>

    <p style="margin: 0 0 20px; font-size: 14px; color: #374151; line-height: 1.6;">
      <strong>${doctorName}</strong> has created a treatment plan for you.
      Please review the details below and accept the plan to proceed.
    </p>

    ${noteBlock}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
      <tr>
        <td style="padding: 16px 20px; background-color: #f9fafb;">
          <p style="margin: 0 0 12px; font-size: 16px; font-weight: 600; color: #111827;">
            ${planTitle}
          </p>
          ${descriptionBlock}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${infoRow("Sessions", `${totalSessions} session${totalSessions > 1 ? "s" : ""}`)}
            ${infoRow("Price per Session", unitPrice)}
            ${discountRow}
            ${infoRow("Total", `<strong>${totalPrice}</strong>`)}
            ${infoRow("Payment", paymentLabel)}
          </table>
        </td>
      </tr>
    </table>

    ${button("View Treatment Plan", planUrl)}

    <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
      This treatment plan expires on <strong>${expiresAt}</strong>. If you have any questions, please contact your doctor directly.
    </p>
  `);

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Follow-Up Invitation
// ---------------------------------------------------------------------------

interface FollowUpInvitationParams {
  patientName: string;
  doctorName: string;
  serviceName: string;
  totalSessions: number;
  unitPrice: string;
  discount: string | null;
  totalPrice: string;
  doctorNote: string | null;
  invitationUrl: string;
  expiresAt: string;
}

export function followUpInvitationEmail({
  patientName,
  doctorName,
  serviceName,
  totalSessions,
  unitPrice,
  discount,
  totalPrice,
  doctorNote,
  invitationUrl,
  expiresAt,
}: FollowUpInvitationParams): { subject: string; html: string } {
  const subject = `Follow-Up Appointment Invitation from ${doctorName}`;

  const noteBlock = doctorNote
    ? `
    <div style="background-color: #eff6ff; border-left: 4px solid ${BRAND_COLOR}; padding: 16px 20px; border-radius: 4px; margin: 0 0 24px;">
      <p style="margin: 0 0 4px; font-size: 13px; color: #6b7280; font-weight: 600;">
        Note from ${doctorName}:
      </p>
      <p style="margin: 0; font-size: 14px; color: #1e3a5f; line-height: 1.6; font-style: italic;">
        "${doctorNote}"
      </p>
    </div>`
    : "";

  const discountRow = discount
    ? infoRow("Discount", `<span style="color: #059669;">−${discount}</span>`)
    : "";

  const html = baseLayout(`
    <h2 style="margin: 0 0 16px; font-size: 20px; color: #111827; font-weight: 700;">
      Follow-Up Appointment Invitation
    </h2>

    <p style="margin: 0 0 20px; font-size: 14px; color: #374151; line-height: 1.6;">
      Hi ${patientName},
    </p>

    <p style="margin: 0 0 20px; font-size: 14px; color: #374151; line-height: 1.6;">
      <strong>${doctorName}</strong> has invited you for a follow-up consultation.
      Please review the details below and book your appointment at your convenience.
    </p>

    ${noteBlock}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
      <tr>
        <td style="padding: 16px 20px; background-color: #f9fafb;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${infoRow("Service", serviceName)}
            ${infoRow("Sessions", `${totalSessions} session${totalSessions > 1 ? "s" : ""}`)}
            ${infoRow("Price per Session", unitPrice)}
            ${discountRow}
            ${infoRow("Total", `<strong>${totalPrice}</strong>`)}
          </table>
        </td>
      </tr>
    </table>

    ${button("View Invitation & Book", invitationUrl)}

    <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
      This invitation expires on <strong>${expiresAt}</strong>. If you have any questions, please contact your doctor directly or reply to this email.
    </p>
  `);

  return { subject, html };
}

export function newMessageEmail({
  recipientName,
  senderName,
  messagesUrl,
}: {
  recipientName: string;
  senderName: string;
  messagesUrl: string;
}): { subject: string; html: string } {
  const subject = `New message from ${senderName} — MyDoctors360`;

  const html = baseLayout(`
    <h2 style="margin: 0 0 16px; font-size: 20px; color: #111827; font-weight: 700;">
      You Have a New Message
    </h2>

    <p style="margin: 0 0 20px; font-size: 14px; color: #374151; line-height: 1.6;">
      Hi ${recipientName},
    </p>

    <p style="margin: 0 0 20px; font-size: 14px; color: #374151; line-height: 1.6;">
      <strong>${senderName}</strong> has sent you a message on MyDoctors360.
      Log in to your account to read and reply.
    </p>

    ${button("View Messages", messagesUrl)}

    <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
      For your privacy, the message content is not included in this email. Please log in to the platform to read your messages.
    </p>
  `);

  return { subject, html };
}

// ─── Invoice Email ────────────────────────────────────────────

interface InvoiceEmailParams {
  patientName: string;
  doctorName: string;
  invoiceNumber: string;
  items: string;
  totalAmount: string;
  dueDate: string;
  invoiceUrl: string;
  doctorNote: string | null;
}

export function invoiceEmail({
  patientName,
  doctorName,
  invoiceNumber,
  items,
  totalAmount,
  dueDate,
  invoiceUrl,
  doctorNote,
}: InvoiceEmailParams): { subject: string; html: string } {
  const subject = `Invoice ${invoiceNumber} from Dr. ${doctorName}`;

  const noteBlock = doctorNote
    ? `
    <div style="background-color: #eff6ff; border-left: 4px solid ${BRAND_COLOR}; padding: 16px 20px; border-radius: 4px; margin: 0 0 24px;">
      <p style="margin: 0 0 4px; font-size: 13px; color: #6b7280; font-weight: 600;">
        Note from Dr. ${doctorName}:
      </p>
      <p style="margin: 0; font-size: 14px; color: #1e3a5f; line-height: 1.6; font-style: italic;">
        "${doctorNote}"
      </p>
    </div>`
    : "";

  const html = baseLayout(`
    <h2 style="margin: 0 0 16px; font-size: 20px; color: #111827; font-weight: 700;">
      You Have a New Invoice
    </h2>

    <p style="margin: 0 0 20px; font-size: 14px; color: #374151; line-height: 1.6;">
      Hi ${patientName},
    </p>

    <p style="margin: 0 0 20px; font-size: 14px; color: #374151; line-height: 1.6;">
      <strong>Dr. ${doctorName}</strong> has sent you an invoice. Please review and pay at your convenience.
    </p>

    ${noteBlock}

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
      <tr>
        <td style="padding: 16px 20px; background-color: #f9fafb;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${infoRow("Invoice", invoiceNumber)}
            ${infoRow("Services", items)}
            ${infoRow("Total", `<strong>${totalAmount}</strong>`)}
            ${infoRow("Due Date", dueDate)}
          </table>
        </td>
      </tr>
    </table>

    ${button("View & Pay Invoice", invoiceUrl)}

    <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
      If you have any questions about this invoice, please contact your doctor directly.
    </p>
  `);

  return { subject, html };
}

// ─── Treatment Continuation Reminder ─────────────────────────────

interface TreatmentReminderParams {
  patientName: string;
  doctorName: string;
  invoiceNumber: string;
  services: string;
  totalAmount: string;
  dueDate: string;
  invoiceUrl: string;
  reminderNumber: 1 | 2 | 3;
}

export function treatmentContinuationEmail({
  patientName,
  doctorName,
  invoiceNumber,
  services,
  totalAmount,
  dueDate,
  invoiceUrl,
  reminderNumber,
}: TreatmentReminderParams): { subject: string; html: string } {
  const subjectByReminder: Record<number, string> = {
    1: `Your recommended treatment plan from Dr. ${doctorName}`,
    2: `Reminder: Dr. ${doctorName} recommended follow-up care for you`,
    3: `Final reminder: Your treatment plan from Dr. ${doctorName}`,
  };

  const introByReminder: Record<number, string> = {
    1: `Following your recent consultation, <strong>Dr. ${doctorName}</strong> has recommended the following treatment plan for your continued care. If you'd like to proceed, you can review and accept it at your convenience.`,
    2: `We wanted to gently remind you that <strong>Dr. ${doctorName}</strong> recommended a follow-up treatment plan after your recent visit. Your health is important, and the recommended care is still available if you'd like to proceed.`,
    3: `This is a final, friendly reminder about the treatment plan <strong>Dr. ${doctorName}</strong> recommended for you. There's no obligation — but if you'd like to continue with the recommended care, the option is still open for a short time.`,
  };

  const subject = subjectByReminder[reminderNumber] || subjectByReminder[1];
  const intro = introByReminder[reminderNumber] || introByReminder[1];

  const html = baseLayout(`
    <h2 style="margin: 0 0 16px; font-size: 20px; color: #111827; font-weight: 700;">
      Your Recommended Treatment Plan
    </h2>

    <p style="margin: 0 0 20px; font-size: 14px; color: #374151; line-height: 1.6;">
      Hi ${patientName},
    </p>

    <p style="margin: 0 0 20px; font-size: 14px; color: #374151; line-height: 1.6;">
      ${intro}
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin: 0 0 24px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
      <tr>
        <td style="padding: 16px 20px; background-color: #f9fafb;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${infoRow("Reference", invoiceNumber)}
            ${infoRow("Recommended Care", services)}
            ${infoRow("Total", `<strong>${totalAmount}</strong>`)}
            ${infoRow("Available Until", dueDate)}
          </table>
        </td>
      </tr>
    </table>

    ${button("Review Treatment Plan", invoiceUrl)}

    <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
      This is a recommendation from your doctor — there is no obligation to proceed.
      If you have any questions about the suggested treatment, please contact Dr. ${doctorName} directly.
    </p>
  `);

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Admin Booking – Payment Link Email
// ---------------------------------------------------------------------------

interface AdminBookingPaymentLinkParams {
  patientName: string;
  doctorName: string;
  date: string;
  time: string;
  consultationType: string;
  bookingNumber: string;
  amount: number;
  currency: string;
  paymentUrl: string;
  expiresInHours: number;
}

export function adminBookingPaymentLinkEmail({
  patientName,
  doctorName,
  date,
  time,
  consultationType,
  bookingNumber,
  amount,
  currency,
  paymentUrl,
  expiresInHours,
}: AdminBookingPaymentLinkParams): { subject: string; html: string } {
  const subject = `Complete Your Booking — ${bookingNumber}`;

  const html = baseLayout(`
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827;">Complete Your Booking</h2>
    <p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.6;">
      Hi ${patientName}, our support team has reserved an appointment for you. Please complete your payment to confirm the booking.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${infoRow("Booking Number", bookingNumber)}
            ${infoRow("Doctor", `Dr. ${doctorName}`)}
            ${infoRow("Date", date)}
            ${infoRow("Time", time)}
            ${infoRow("Consultation", consultationType)}
            ${infoRow("Amount", `<strong>${currency} ${amount.toFixed(2)}</strong>`)}
          </table>
        </td>
      </tr>
    </table>

    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 16px;">
      <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
        <strong>Important:</strong> This payment link expires in ${expiresInHours} hours. If the link expires, please contact our support team for a new one.
      </p>
    </div>

    ${button("Complete Payment", paymentUrl)}

    <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
      Your appointment will only be confirmed once payment is complete. If you did not request this booking, please ignore this email or contact our support team.
    </p>
  `);

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Reschedule Request Email (sent to doctor)
// ---------------------------------------------------------------------------

interface RescheduleRequestParams {
  doctorName: string;
  patientName: string;
  originalDate: string;
  originalTime: string;
  newDate: string;
  newTime: string;
  dashboardUrl: string;
}

export function rescheduleRequestEmail({
  doctorName,
  patientName,
  originalDate,
  originalTime,
  newDate,
  newTime,
  dashboardUrl,
}: RescheduleRequestParams): { subject: string; html: string } {
  const subject = `Reschedule Request from ${patientName}`;

  const html = baseLayout(`
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827;">Reschedule Request</h2>
    <p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.6;">
      Hi Dr. ${doctorName}, <strong>${patientName}</strong> has requested to reschedule their appointment.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${infoRow("Original Date", originalDate)}
            ${infoRow("Original Time", originalTime)}
            <tr><td colspan="2" style="padding: 8px 0;"><hr style="border: none; border-top: 1px solid #e5e7eb;"></td></tr>
            ${infoRow("Requested Date", `<strong style="color: ${BRAND_COLOR};">${newDate}</strong>`)}
            ${infoRow("Requested Time", `<strong style="color: ${BRAND_COLOR};">${newTime}</strong>`)}
          </table>
        </td>
      </tr>
    </table>

    <p style="margin: 0 0 16px; font-size: 14px; color: #374151; line-height: 1.6;">
      Please review and approve or decline this request from your dashboard.
    </p>

    ${button("Review Request", dashboardUrl)}
  `);

  return { subject, html };
}

// ---------------------------------------------------------------------------
// Reschedule Response Email (sent to patient)
// ---------------------------------------------------------------------------

interface RescheduleResponseParams {
  patientName: string;
  doctorName: string;
  approved: boolean;
  newDate?: string;
  newTime?: string;
  originalDate: string;
  originalTime: string;
  rejectionReason?: string;
  dashboardUrl: string;
}

export function rescheduleResponseEmail({
  patientName,
  doctorName,
  approved,
  newDate,
  newTime,
  originalDate,
  originalTime,
  rejectionReason,
  dashboardUrl,
}: RescheduleResponseParams): { subject: string; html: string } {
  const subject = approved
    ? "Reschedule Approved — Your New Appointment"
    : "Reschedule Request Declined";

  const statusColor = approved ? "#059669" : "#dc2626";
  const statusText = approved ? "Approved" : "Declined";

  const html = baseLayout(`
    <h2 style="margin: 0 0 8px; font-size: 20px; color: #111827;">Reschedule ${statusText}</h2>
    <p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.6;">
      Hi ${patientName}, your reschedule request with <strong>Dr. ${doctorName}</strong> has been <span style="color: ${statusColor}; font-weight: 600;">${statusText.toLowerCase()}</span>.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 6px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${approved
              ? `${infoRow("New Date", `<strong>${newDate}</strong>`)}
                 ${infoRow("New Time", `<strong>${newTime}</strong>`)}`
              : `${infoRow("Original Date", originalDate)}
                 ${infoRow("Original Time", originalTime)}
                 <tr><td colspan="2" style="padding: 8px 0;">
                   <p style="margin: 0; font-size: 13px; color: #6b7280;">Your original appointment remains unchanged.</p>
                 </td></tr>`
            }
          </table>
        </td>
      </tr>
    </table>

    ${rejectionReason ? `
    <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 16px;">
      <p style="margin: 0; font-size: 13px; color: #991b1b; line-height: 1.5;">
        <strong>Reason:</strong> ${rejectionReason}
      </p>
    </div>
    ` : ""}

    ${button("View My Bookings", dashboardUrl)}
  `);

  return { subject, html };
}
