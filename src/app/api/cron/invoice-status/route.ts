import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { createNotification } from "@/lib/notifications";
import { formatCurrency } from "@/lib/utils/currency";
import { log } from "@/lib/utils/logger";

/**
 * Cron: Invoice status transitions
 *
 * 1. Mark overdue: invoices past due_date that are still "sent" or "viewed"
 * 2. Send reminders: up to 3 reminders for overdue invoices (at 1, 7, 14 days overdue)
 * 3. Mark expired: invoices overdue for 30+ days → "expired"
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  // 1. Mark overdue: unpaid invoices past due date
  const { data: overdueInvoices, error: overdueError } = await supabase
    .from("invoices")
    .update({ status: "overdue" })
    .in("status", ["sent", "viewed"])
    .lt("due_date", today)
    .select("id, invoice_number, patient_id, total_cents, currency");

  if (overdueError) {
    log.error("Invoice overdue update error:", { err: overdueError });
  }

  // Notify patients about newly overdue invoices
  for (const inv of overdueInvoices || []) {
    createNotification({
      userId: inv.patient_id,
      type: "invoice_overdue",
      title: "Invoice Overdue",
      message: `Invoice ${inv.invoice_number} for ${formatCurrency(inv.total_cents, inv.currency)} is now overdue. Please pay at your earliest convenience.`,
      channels: ["in_app"],
      metadata: { invoice_id: inv.id },
    }).catch((err) => log.error("Invoice overdue notification error:", { err }));
  }

  // 2. Send reminders for overdue invoices (max 3 reminders)
  const { data: reminderInvoices } = await supabase
    .from("invoices")
    .select(
      `id, invoice_number, total_cents, currency, due_date, reminders_sent, last_reminder_at,
       patient:profiles!invoices_patient_id_fkey(first_name, email),
       doctor:doctors!invoices_doctor_id_fkey(
         profile:profiles!doctors_profile_id_fkey(first_name, last_name)
       )`
    )
    .eq("status", "overdue")
    .lt("reminders_sent", 3);

  let remindersSent = 0;

  for (const inv of reminderInvoices || []) {
    const daysSinceLastReminder = inv.last_reminder_at
      ? Math.floor(
          (Date.now() - new Date(inv.last_reminder_at).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 999;

    // Space reminders: first at overdue, then 7 days later, then 14 days later
    const minDaysBetween = inv.reminders_sent === 0 ? 0 : 7;
    if (daysSinceLastReminder < minDaysBetween) continue;

    const patient: any = Array.isArray(inv.patient)
      ? inv.patient[0]
      : inv.patient;
    const doctor: any = Array.isArray(inv.doctor)
      ? inv.doctor[0]
      : inv.doctor;
    const doctorProfile: any = doctor
      ? Array.isArray(doctor.profile)
        ? doctor.profile[0]
        : doctor.profile
      : null;

    if (patient?.email) {
      const doctorName = doctorProfile
        ? `${doctorProfile.first_name} ${doctorProfile.last_name}`
        : "Your doctor";

      sendEmail({
        to: patient.email,
        subject: `Reminder: Invoice ${inv.invoice_number} is overdue`,
        html: `
          <p>Hi ${patient.first_name || "there"},</p>
          <p>This is a reminder that invoice <strong>${inv.invoice_number}</strong> from Dr. ${doctorName} for <strong>${formatCurrency(inv.total_cents, inv.currency)}</strong> is overdue.</p>
          <p>Please log in to your MyDoctors360 dashboard to make your payment.</p>
          <p>Thank you,<br/>MyDoctors360</p>
        `,
      }).catch((err) =>
        log.error("Invoice reminder email error:", { err })
      );
    }

    await supabase
      .from("invoices")
      .update({
        reminders_sent: (inv.reminders_sent || 0) + 1,
        last_reminder_at: new Date().toISOString(),
      })
      .eq("id", inv.id);

    remindersSent++;
  }

  // 3. Expire invoices overdue for 30+ days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const expiryCutoff = thirtyDaysAgo.toISOString().split("T")[0];

  const { data: expiredInvoices, error: expiredError } = await supabase
    .from("invoices")
    .update({ status: "expired" })
    .eq("status", "overdue")
    .lt("due_date", expiryCutoff)
    .select("id");

  if (expiredError) {
    log.error("Invoice expired update error:", { err: expiredError });
  }

  return NextResponse.json({
    markedOverdue: overdueInvoices?.length || 0,
    remindersSent,
    markedExpired: expiredInvoices?.length || 0,
  });
}
