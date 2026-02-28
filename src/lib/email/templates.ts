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
  clinicName?: string | null;
  address?: string | null;
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

    <!-- Why Doctors Choose MyDoctor -->
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
      If your issue is urgent, you can also reach us via WhatsApp or email at support@mydoctor.com.
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mydoctor.com";

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
