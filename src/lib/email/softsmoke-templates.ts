/**
 * Softsmoke tester-path transactional bodies (Creative-OK 2026-09-26).
 *
 * Hairline header replaces SPECIALTY_ICONS_ROW. Footer banner is required.
 * Soft CTA founding-doctor marketing mail stays HOLD — there is no template
 * for it in this module.
 */

import {
  SOFT_LAUNCH_SOFTSMOKE_DOCTOR,
  isSoftLaunchSoftsmokeDoctor,
} from "@/lib/soft-launch/softsmoke-connect-bypass";
import {
  formatAppointmentWhen,
  formatEmailDateTime,
} from "@/lib/email/format-appointment";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com";

export const SOFTSMOKE_BANNER_LINE =
  "Softsmoke transactional — tester path only. Soft CTA founding email HOLD.";

export const SOFTSMOKE_MARKETPLACE_LINE =
  "MyDoctors360 is a private GP booking marketplace. We help patients book appointments with independent doctors — we do not provide medical care and are not a CQC-registered care provider.";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export function isSoftsmokeTransactionalDoctor(
  doctor?: {
    id?: string | null;
    slug?: string | null;
    email?: string | null;
  } | null
): boolean {
  if (!doctor?.id) return false;
  const idMatches = doctor.id === SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id;
  return isSoftLaunchSoftsmokeDoctor({
    id: doctor.id,
    slug:
      doctor.slug ??
      (idMatches ? SOFT_LAUNCH_SOFTSMOKE_DOCTOR.slug : null),
    email:
      doctor.email ??
      (idMatches ? SOFT_LAUNCH_SOFTSMOKE_DOCTOR.email : null),
  });
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function firstNameOnly(
  name: string | null | undefined,
  fallback: string
): string {
  const token = (name ?? "").trim().split(/\s+/)[0];
  return token || fallback;
}

export function formatDoctorDisplayName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "Your doctor";
  const rest = trimmed.replace(/^dr\.?\s+/i, "");
  return `Dr. ${rest}`;
}

/** John-safe admin label. Video consultation is a booking type, not a care claim. */
export function formatAppointmentType(raw: string | null | undefined): string {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return "Appointment";
  if (value === "video" || value.includes("video")) return "Video consultation";
  if (value === "phone" || value.includes("phone")) return "Phone consultation";
  if (
    value === "in_person" ||
    value.includes("in-person") ||
    value.includes("in person")
  ) {
    return "In-person appointment";
  }
  return raw!.trim();
}

export function formatMoney(amount: number | string): string {
  if (typeof amount === "number") {
    if (!Number.isFinite(amount)) return "0.00";
    return amount.toFixed(2);
  }
  const trimmed = amount.trim();
  if (!trimmed) return "0.00";
  const numeric = Number(trimmed.replace(/,/g, ""));
  if (Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(trimmed.replace(/,/g, ""))) {
    return numeric.toFixed(2);
  }
  return trimmed;
}

function whenFields(input: {
  date?: string | null;
  time?: string | null;
  timeZone?: string;
}) {
  return formatAppointmentWhen({
    date: input.date,
    time: input.time,
    timeZone: input.timeZone,
  });
}

function softsmokeLayout(bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>MyDoctors360</title>
</head>
<body style="margin:0; padding:0; background-color:#f7f5f0; font-family:${FONT}; letter-spacing:normal;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f7f5f0; letter-spacing:normal;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:600px; background-color:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #e8e6e1;">
          <tr>
            <td align="center" style="background-color:#0B6BCB; background:linear-gradient(90deg, #0B6BCB 0%, #14B8A6 100%); padding:28px 32px 10px; letter-spacing:normal;">
              <h1 style="margin:0; color:#ffffff; font-size:24px; font-weight:700; font-family:${FONT}; letter-spacing:normal;">MyDoctors360</h1>
              <p style="margin:6px 0 0; color:rgba(255,255,255,0.90); font-size:13px; font-weight:400; font-family:${FONT}; letter-spacing:normal;">Where Patients Meet the Right Doctor</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="background-color:#0B6BCB; background:linear-gradient(90deg, #0B6BCB 0%, #14B8A6 100%); padding:8px 32px 22px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                <tr>
                  <td width="120" height="1" style="width:120px; height:1px; max-height:1px; font-size:0; line-height:0; background-color:rgba(255,255,255,0.40);">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 8px; letter-spacing:normal;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px; background-color:#f9fafb; border-top:1px solid #e5e7eb; letter-spacing:normal;">
              <p style="margin:0 0 8px; font-size:12px; color:#5c5c5c; line-height:1.55; font-family:${FONT}; letter-spacing:normal;">
                ${SOFTSMOKE_MARKETPLACE_LINE}
              </p>
              <p style="margin:12px 0 0; font-size:11px; color:#9ca3af; line-height:1.5; font-family:${FONT}; letter-spacing:normal;">
                ${SOFTSMOKE_BANNER_LINE}
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

function detailRow(label: string, value: string, last = false): string {
  const border = last ? "" : "border-bottom:1px solid #e5e7eb;";
  return `
    <tr>
      <td style="padding:10px 0; ${border} font-size:13px; color:#5c5c5c; width:38%; vertical-align:top; letter-spacing:normal;">${escapeHtml(label)}</td>
      <td style="padding:10px 0; ${border} font-size:14px; color:#1a1a1a; font-weight:600; text-align:right; vertical-align:top; letter-spacing:normal;">${value}</td>
    </tr>`;
}

function detailsCard(rows: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6; border-radius:8px; margin:0 0 24px;">
      <tr>
        <td style="padding:8px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${rows}
          </table>
        </td>
      </tr>
    </table>`;
}

function primaryButton(label: string, href: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;">
      <tr>
        <td align="center" style="background-color:#0B6BCB; border-radius:6px;">
          <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block; padding:12px 24px; color:#ffffff; font-size:14px; font-weight:600; text-decoration:none; font-family:${FONT}; letter-spacing:normal;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`;
}

function secondaryButton(label: string, href: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;">
      <tr>
        <td align="center" style="background-color:#ffffff; border:1px solid #0B6BCB; border-radius:6px;">
          <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block; padding:11px 22px; color:#0B6BCB; font-size:14px; font-weight:600; text-decoration:none; font-family:${FONT}; letter-spacing:normal;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`;
}

function heading(text: string): string {
  return `<h2 style="margin:0 0 10px; font-size:20px; font-weight:700; color:#1a1a1a; letter-spacing:normal;">${escapeHtml(text)}</h2>`;
}

function intro(html: string): string {
  return `<p style="margin:0 0 24px; font-size:15px; color:#5c5c5c; line-height:1.6; letter-spacing:normal;">${html}</p>`;
}

function textValue(value: string): string {
  return escapeHtml(value);
}

export function manageBookingUrl(bookingId?: string | null): string {
  if (bookingId) return `${APP_URL}/en/dashboard/bookings/${bookingId}`;
  return `${APP_URL}/en/dashboard/bookings`;
}

export function doctorDiaryUrl(): string {
  return `${APP_URL}/en/doctor-dashboard/bookings`;
}

export function payoutsDashboardUrl(): string {
  return `${APP_URL}/en/doctor-dashboard/payments`;
}

export interface SoftsmokeBookingFields {
  patientFirstName: string;
  doctorDisplayName?: string;
  doctorFirstName?: string;
  appointmentDate: string;
  appointmentTime: string;
  timeZone?: string;
  bookingRef: string;
  appointmentType?: string | null;
  joinUrl?: string | null;
  manageUrl?: string | null;
  diaryUrl?: string | null;
}

function bookingDetails(fields: SoftsmokeBookingFields, who: "doctor" | "patient") {
  const when = whenFields({
    date: fields.appointmentDate,
    time: fields.appointmentTime,
    timeZone: fields.timeZone,
  });
  const type = formatAppointmentType(fields.appointmentType);
  const rows = [
    detailRow("Booking ref", textValue(fields.bookingRef)),
    who === "patient"
      ? detailRow("Doctor", textValue(fields.doctorDisplayName || "Your doctor"))
      : detailRow("Patient", textValue(fields.patientFirstName)),
    detailRow("Date", textValue(when.date)),
    detailRow("Time", textValue(`${when.time} ${when.timezone}`)),
    detailRow("Type", textValue(type), true),
  ].join("");
  return { when, type, card: detailsCard(rows) };
}

export function softsmokePatientConfirmEmail(
  fields: SoftsmokeBookingFields
): { subject: string; html: string } {
  const { card } = bookingDetails(
    {
      ...fields,
      doctorDisplayName: formatDoctorDisplayName(fields.doctorDisplayName || ""),
      patientFirstName: firstNameOnly(fields.patientFirstName, "there"),
    },
    "patient"
  );
  const patient = firstNameOnly(fields.patientFirstName, "there");
  const manage = fields.manageUrl || manageBookingUrl();
  const join = fields.joinUrl?.trim();
  const html = softsmokeLayout(`
    ${heading("Your booking is confirmed")}
    ${intro(`Hi ${escapeHtml(patient)}, your appointment is confirmed. Here are your booking details.`)}
    ${card}
    <p style="margin:0 0 16px; font-size:14px; color:#1a1a1a; line-height:1.55; letter-spacing:normal;">
      For video appointments, use the join link below when it is time. You can also manage your booking anytime.
    </p>
    ${join ? primaryButton("Join Video Call", join) : ""}
    ${secondaryButton("View Booking Details", manage)}
  `);
  return {
    subject: `Booking confirmed — ${fields.bookingRef}`,
    html,
  };
}

export function softsmokePatientReminderEmail(
  fields: SoftsmokeBookingFields
): { subject: string; html: string } {
  const named = {
    ...fields,
    doctorDisplayName: formatDoctorDisplayName(fields.doctorDisplayName || ""),
    patientFirstName: firstNameOnly(fields.patientFirstName, "there"),
  };
  const { when, card } = bookingDetails(named, "patient");
  const manage = fields.manageUrl || manageBookingUrl();
  const join = fields.joinUrl?.trim();
  const html = softsmokeLayout(`
    ${heading("Friendly reminder — your appointment is coming up")}
    ${intro(`Hi ${escapeHtml(named.patientFirstName)}, this is a friendly reminder that your appointment with ${escapeHtml(named.doctorDisplayName || "your doctor")} is coming up.`)}
    ${card}
    ${join ? primaryButton("Join Video Call", join) : ""}
    ${secondaryButton("View Booking Details", manage)}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eff6ff; border-left:4px solid #0B6BCB; border-radius:0 6px 6px 0; margin:16px 0 0;">
      <tr>
        <td style="padding:14px 16px;">
          <p style="margin:0 0 8px; font-size:13px; font-weight:600; color:#1a1a1a; letter-spacing:normal;">Before you join</p>
          <p style="margin:0; font-size:13px; color:#5c5c5c; line-height:1.55; letter-spacing:normal;">
            Have any records you want to hand over ready.<br />
            Note down the questions you want to ask.<br />
            Use a stable internet connection and a working camera and microphone.
          </p>
        </td>
      </tr>
    </table>
  `);
  return {
    subject: `Appointment reminder — ${when.date}`,
    html,
  };
}

export function softsmokePatientRescheduleEmail(fields: {
  patientFirstName: string;
  doctorDisplayName: string;
  bookingRef: string;
  oldDate: string;
  oldTime: string;
  newDate: string;
  newTime: string;
  timeZone?: string;
  appointmentType?: string | null;
  manageUrl?: string | null;
}): { subject: string; html: string } {
  const oldWhen = whenFields({
    date: fields.oldDate,
    time: fields.oldTime,
    timeZone: fields.timeZone,
  });
  const newWhen = whenFields({
    date: fields.newDate,
    time: fields.newTime,
    timeZone: fields.timeZone,
  });
  const patient = firstNameOnly(fields.patientFirstName, "there");
  const doctor = formatDoctorDisplayName(fields.doctorDisplayName);
  const type = formatAppointmentType(fields.appointmentType);
  const manage = fields.manageUrl || manageBookingUrl();
  const html = softsmokeLayout(`
    ${heading("Your booking has been updated")}
    ${intro(`Hi ${escapeHtml(patient)}, your appointment has been rescheduled. Please review the new date and time below.`)}
    ${detailsCard(
      [
        detailRow("Booking ref", textValue(fields.bookingRef)),
        detailRow("Doctor", textValue(doctor)),
        detailRow(
          "Previous",
          textValue(`${oldWhen.date} · ${oldWhen.time} ${oldWhen.timezone}`)
        ),
        detailRow("New date", textValue(newWhen.date)),
        detailRow("New time", textValue(`${newWhen.time} ${newWhen.timezone}`)),
        detailRow("Type", textValue(type), true),
      ].join("")
    )}
    <p style="margin:0 0 16px; font-size:14px; color:#5c5c5c; line-height:1.55; letter-spacing:normal;">
      If this change does not work for you, use Manage booking to pick another slot or cancel.
    </p>
    ${primaryButton("Manage booking", manage)}
  `);
  return { subject: `Booking updated — ${fields.bookingRef}`, html };
}

export function softsmokePatientRefundEmail(fields: {
  patientFirstName: string;
  bookingRef: string;
  refundRef: string;
  refundAmount: number | string;
  currency: string;
  originalPaidAt?: string | null;
  timeZone?: string;
  manageUrl?: string | null;
}): { subject: string; html: string } {
  const patient = firstNameOnly(fields.patientFirstName, "there");
  const paid = formatEmailDateTime(fields.originalPaidAt, fields.timeZone);
  const manage = fields.manageUrl || manageBookingUrl();
  const currency = (fields.currency || "GBP").toUpperCase();
  const html = softsmokeLayout(`
    ${heading("Refund notice")}
    ${intro(`Hi ${escapeHtml(patient)}, a refund has been issued for your MyDoctors360 booking payment. This is a marketplace receipt notice for your records.`)}
    ${detailsCard(
      [
        detailRow("Booking ref", textValue(fields.bookingRef)),
        detailRow("Refund ref", textValue(fields.refundRef)),
        detailRow(
          "Refund amount",
          textValue(`${currency} ${formatMoney(fields.refundAmount)}`)
        ),
        detailRow("Originally paid", textValue(paid), true),
      ].join("")
    )}
    <p style="margin:0 0 16px; font-size:14px; color:#5c5c5c; line-height:1.55; letter-spacing:normal;">
      Refunds are processed back to the original payment method. Timing depends on your bank or card provider. This notice is not a clinical communication.
    </p>
    ${primaryButton("View booking", manage)}
  `);
  return { subject: `Refund notice — ${fields.bookingRef}`, html };
}

export function softsmokeDoctorNewBookingEmail(
  fields: SoftsmokeBookingFields
): { subject: string; html: string } {
  const named = {
    ...fields,
    patientFirstName: firstNameOnly(fields.patientFirstName, "A patient"),
    doctorFirstName: firstNameOnly(fields.doctorFirstName, "there"),
  };
  const { card } = bookingDetails(named, "doctor");
  const diary = fields.diaryUrl || doctorDiaryUrl();
  const html = softsmokeLayout(`
    ${heading("New booking on your diary")}
    ${intro(`Hi ${escapeHtml(named.doctorFirstName || "there")}, you have a new confirmed booking on your MyDoctors360 diary.`)}
    ${card}
    <p style="margin:0 0 16px; font-size:14px; color:#5c5c5c; line-height:1.55; letter-spacing:normal;">
      Open your diary to review the booking and manage your schedule.
    </p>
    ${primaryButton("Open diary", diary)}
  `);
  return { subject: `New booking on your diary — ${fields.bookingRef}`, html };
}

export function softsmokeDoctorReminderEmail(
  fields: SoftsmokeBookingFields
): { subject: string; html: string } {
  const named = {
    ...fields,
    patientFirstName: firstNameOnly(fields.patientFirstName, "A patient"),
    doctorFirstName: firstNameOnly(fields.doctorFirstName, "there"),
  };
  const { when, card } = bookingDetails(named, "doctor");
  const diary = fields.diaryUrl || doctorDiaryUrl();
  const html = softsmokeLayout(`
    ${heading("Diary reminder")}
    ${intro(`Hi ${escapeHtml(named.doctorFirstName || "there")}, this is a reminder that you have an upcoming booking on your MyDoctors360 diary.`)}
    ${card}
    ${primaryButton("Open diary", diary)}
  `);
  return { subject: `Diary reminder — ${when.date}`, html };
}

export function softsmokeDoctorCancelRescheduleEmail(fields: {
  kind: "cancel" | "reschedule";
  doctorFirstName: string;
  patientFirstName: string;
  bookingRef: string;
  oldDate: string;
  oldTime: string;
  newDate?: string | null;
  newTime?: string | null;
  timeZone?: string;
  appointmentType?: string | null;
  diaryUrl?: string | null;
}): { subject: string; html: string } {
  const oldWhen = whenFields({
    date: fields.oldDate,
    time: fields.oldTime,
    timeZone: fields.timeZone,
  });
  const doctor = firstNameOnly(fields.doctorFirstName, "there");
  const patient = firstNameOnly(fields.patientFirstName, "A patient");
  const type = formatAppointmentType(fields.appointmentType);
  const diary = fields.diaryUrl || doctorDiaryUrl();
  const cancelled = fields.kind === "cancel";
  const headingText = cancelled ? "Booking cancelled" : "Booking updated";
  let current: string;
  if (cancelled) {
    current = "Cancelled";
  } else {
    const newWhen = whenFields({
      date: fields.newDate,
      time: fields.newTime,
      timeZone: fields.timeZone,
    });
    current = `${newWhen.date} · ${newWhen.time} ${newWhen.timezone}`;
  }
  const html = softsmokeLayout(`
    ${heading(headingText)}
    ${intro(`Hi ${escapeHtml(doctor)}, a booking on your diary has changed. Details below.`)}
    ${detailsCard(
      [
        detailRow("Booking ref", textValue(fields.bookingRef)),
        detailRow("Patient", textValue(patient)),
        detailRow(
          "Previous",
          textValue(`${oldWhen.date} · ${oldWhen.time} ${oldWhen.timezone}`)
        ),
        detailRow("Current / status", textValue(current)),
        detailRow("Type", textValue(type), true),
      ].join("")
    )}
    <p style="margin:0 0 16px; font-size:14px; color:#5c5c5c; line-height:1.55; letter-spacing:normal;">
      For a reschedule, the new slot replaces the previous one on your diary. For a cancellation, the slot is released.
    </p>
    ${primaryButton("Open diary", diary)}
  `);
  const subjectVerb = cancelled ? "Booking cancelled" : "Booking updated";
  return { subject: `${subjectVerb} — ${fields.bookingRef}`, html };
}

export function softsmokeDoctorPayoutEmail(fields: {
  doctorFirstName: string;
  grossAmount: number | string;
  platformFee: number | string;
  netToConnectedAccount: number | string;
  currency: string;
  bookingRef: string;
  payoutOrTransferRef: string;
  periodOrDate: string;
  timeZone?: string;
  payoutsDashboardUrl?: string | null;
}): { subject: string; html: string } {
  const doctor = firstNameOnly(fields.doctorFirstName, "there");
  const currency = (fields.currency || "GBP").toUpperCase();
  const period = formatEmailDateTime(fields.periodOrDate, fields.timeZone);
  const money = (amount: number | string) =>
    `${currency} ${formatMoney(amount)}`;
  const dashboard = fields.payoutsDashboardUrl || payoutsDashboardUrl();
  const html = softsmokeLayout(`
    ${heading("Consult fee settlement notice")}
    ${intro(`Hi ${escapeHtml(doctor)}, this is a marketplace settlement notice for a consult fee related to booking ${escapeHtml(fields.bookingRef)}.`)}
    ${detailsCard(
      [
        detailRow("Period / date", textValue(period)),
        detailRow("Booking ref", textValue(fields.bookingRef)),
        detailRow("Transfer / payout ref", textValue(fields.payoutOrTransferRef)),
        detailRow("Gross consult fee", textValue(money(fields.grossAmount))),
        detailRow("Platform fee (MD360)", textValue(money(fields.platformFee))),
        detailRow(
          "Net to Connected Account",
          textValue(money(fields.netToConnectedAccount)),
          true
        ),
      ].join("")
    )}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; margin:0 0 20px;">
      <tr>
        <td style="padding:16px 18px;">
          <p style="margin:0 0 10px; font-size:13px; font-weight:600; color:#1a1a1a; letter-spacing:normal;">What this notice means</p>
          <p style="margin:0; font-size:13px; color:#5c5c5c; line-height:1.6; letter-spacing:normal;">
            This is a marketplace platform fee / consult fee settlement notice.<br /><br />
            The consult fee settles to your <strong style="color:#1a1a1a;">Stripe Connected Account</strong>. MyDoctors360 took a platform fee on the booking.<br /><br />
            MyDoctors360 is not framed here as the merchant of record for the consult; funds for the consult settle to your Connected Account after the platform fee.<br /><br />
            This is <strong style="color:#1a1a1a;">not</strong> staff pay, payroll, or salary.
          </p>
        </td>
      </tr>
    </table>
    <p style="margin:0 0 16px; font-size:13px; color:#5c5c5c; line-height:1.55; letter-spacing:normal;">
      Amounts shown are factual settlement figures for this booking. This notice does not guarantee future earnings.
    </p>
    ${primaryButton("View payouts", dashboard)}
  `);
  return {
    subject: `Consult fee settlement — ${fields.payoutOrTransferRef}`,
    html,
  };
}
