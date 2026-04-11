import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { treatmentContinuationEmail } from "@/lib/email/templates";
import { formatCurrency } from "@/lib/utils/currency";

/**
 * Treatment Continuation Reminders
 *
 * Sends gentle, health-focused reminders for unpaid invoices (recommended
 * follow-up care). These are NOT payment demands — patients always have
 * the choice whether to continue with the care plan.
 *
 * Schedule: 3 reminders max, spaced out:
 *   Reminder 1: 3 days before due date
 *   Reminder 2: on due date
 *   Reminder 3: 7 days after due date
 *
 * After 14 days past due: auto-expire (no more reminders, invoice marked expired)
 */

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  // 1. Auto-expire invoices that are 14+ days past due
  const expiryCutoff = new Date(now);
  expiryCutoff.setDate(expiryCutoff.getDate() - 14);

  const { data: expired } = await supabase
    .from("invoices")
    .update({ status: "expired" })
    .in("status", ["sent", "viewed"])
    .lt("due_date", expiryCutoff.toISOString().split("T")[0])
    .select("id");

  const expiredCount = expired?.length || 0;

  // 2. Fetch invoices eligible for reminders (sent or viewed, not yet expired, < 3 reminders sent)
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(
      `
      id,
      invoice_number,
      items,
      total_cents,
      currency,
      due_date,
      status,
      reminders_sent,
      last_reminder_at,
      doctor_id,
      patient_id,
      patient:profiles!invoices_patient_id_fkey(first_name, last_name, email),
      doctor:doctors!inner(
        profile:profiles!doctors_profile_id_fkey(first_name, last_name)
      )
    `
    )
    .in("status", ["sent", "viewed"])
    .lt("reminders_sent", 3);

  if (error || !invoices || invoices.length === 0) {
    return NextResponse.json({
      message: error ? "Query error" : "No invoices need reminders",
      error: error?.message,
      expired: expiredCount,
      reminders_sent: 0,
    });
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL || "https://app.mydoctors360.com";
  let remindersSent = 0;

  for (const invoice of invoices) {
    const dueDate = new Date(invoice.due_date + "T00:00:00Z");
    const daysToDue = Math.floor(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const nextReminderNumber = (invoice.reminders_sent + 1) as 1 | 2 | 3;

    // Determine if it's time to send the next reminder
    let shouldSend = false;
    if (nextReminderNumber === 1 && daysToDue <= 3) {
      shouldSend = true;
    } else if (nextReminderNumber === 2 && daysToDue <= 0) {
      shouldSend = true;
    } else if (nextReminderNumber === 3 && daysToDue <= -7) {
      shouldSend = true;
    }

    if (!shouldSend) continue;

    // Don't send multiple reminders within 48 hours
    if (invoice.last_reminder_at) {
      const hoursSinceLast =
        (now.getTime() - new Date(invoice.last_reminder_at).getTime()) /
        (1000 * 60 * 60);
      if (hoursSinceLast < 48) continue;
    }

    // Resolve nested joins
    const patient: any = Array.isArray(invoice.patient)
      ? invoice.patient[0]
      : invoice.patient;
    const doctor: any = Array.isArray(invoice.doctor)
      ? invoice.doctor[0]
      : invoice.doctor;
    const doctorProfile: any = doctor?.profile
      ? Array.isArray(doctor.profile)
        ? doctor.profile[0]
        : doctor.profile
      : null;

    if (!patient?.email || !doctorProfile) continue;

    const doctorName = `${doctorProfile.first_name} ${doctorProfile.last_name}`;
    const items: { name: string; quantity: number }[] = Array.isArray(
      invoice.items
    )
      ? invoice.items
      : [];
    const servicesSummary = items
      .map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`)
      .join(", ");

    const { subject, html } = treatmentContinuationEmail({
      patientName: patient.first_name || "Patient",
      doctorName,
      invoiceNumber: invoice.invoice_number,
      services: servicesSummary || "Follow-up care",
      totalAmount: formatCurrency(invoice.total_cents, invoice.currency),
      dueDate: dueDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
      invoiceUrl: `${origin}/en/dashboard/invoices`,
      reminderNumber: nextReminderNumber,
    });

    await sendEmail({ to: patient.email, subject, html });

    // Update reminder count
    await supabase
      .from("invoices")
      .update({
        reminders_sent: nextReminderNumber,
        last_reminder_at: now.toISOString(),
      })
      .eq("id", invoice.id);

    // Create in-app notification
    await supabase.from("notifications").insert({
      user_id: invoice.patient_id,
      type: "treatment_reminder",
      title: "Recommended Care Plan",
      body: `Dr. ${doctorName} recommended follow-up care for you. Review your care plan when you're ready.`,
      channel: "in_app",
      data: { invoice_id: invoice.id },
    });

    remindersSent++;
  }

  return NextResponse.json({
    invoices_checked: invoices.length,
    reminders_sent: remindersSent,
    expired: expiredCount,
  });
}
