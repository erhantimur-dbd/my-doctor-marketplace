// Email templates as pure functions returning { subject, html }
// No external React Email dependency needed - uses inline CSS for compatibility

const BRAND_COLOR = "#2563EB";
const BRAND_NAME = "MyDoctor";

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
            <td style="background-color: ${BRAND_COLOR}; padding: 24px 32px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">
                ${BRAND_NAME}
              </h1>
              <p style="margin: 4px 0 0; color: rgba(255, 255, 255, 0.85); font-size: 13px;">
                Your Trusted Medical Marketplace
              </p>
            </td>
          </tr>
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
        Please arrive 5 minutes before your scheduled time. If you need to reschedule or cancel, please do so at least 24 hours in advance.
      </p>
    </div>`;

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
            ${infoRow("Amount Paid", `${currency} ${amount.toFixed(2)}`)}
          </table>
        </td>
      </tr>
    </table>

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
}

export function bookingCancellationEmail({
  patientName,
  doctorName,
  date,
  time,
  bookingNumber,
  refundAmount,
  currency,
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
            A refund of <strong>${currency} ${refundAmount.toFixed(2)}</strong> will be processed to your original payment method within 5-10 business days.
          </p>
        </div>`
      : `<div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; border-radius: 0 6px 6px 0; margin-bottom: 16px;">
          <p style="margin: 0; font-size: 13px; color: #991b1b; line-height: 1.5;">
            This cancellation is not eligible for a refund based on our cancellation policy.
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
        ${videoRoomUrl ? "&bull; Ensure you have a stable internet connection and a working camera/microphone." : "&bull; Please arrive 5 minutes before your scheduled time."}
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
