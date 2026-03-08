"use server";

import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { sendEmail } from "@/lib/email/client";
import { invoiceEmail } from "@/lib/email/templates";
import { createNotification } from "@/lib/notifications";
import { formatCurrency, getBookingFeeCents } from "@/lib/utils/currency";

// ─── helpers ───────────────────────────────────────────────────

async function requireDoctor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", supabase: null, doctor: null };

  const { data: doctor } = await supabase
    .from("doctors")
    .select(
      "id, profile_id, stripe_account_id, stripe_onboarding_complete, base_currency, profile:profiles!doctors_profile_id_fkey(first_name, last_name, email)"
    )
    .eq("profile_id", user.id)
    .single();

  if (!doctor) return { error: "Not a doctor", supabase: null, doctor: null };
  return { error: null, supabase, doctor };
}

async function getOriginAndLocale() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  const origin = host
    ? `${proto}://${host}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const referer = h.get("referer") || "";
  const localeMatch = referer.match(/\/(en|de|tr|fr|it|es|pt|zh|ja)(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : "en";

  return { origin, locale };
}

// ─── types ────────────────────────────────────────────────────

export interface InvoiceItem {
  name: string;
  price_cents: number;
  quantity: number;
}

export interface CreateInvoiceInput {
  patient_id: string;
  items: InvoiceItem[];
  discount_type?: "percentage" | "fixed_amount" | null;
  discount_value?: number | null;
  due_days?: number;
  doctor_note?: string | null;
}

// ─── actions ──────────────────────────────────────────────────

export async function createInvoice(
  input: CreateInvoiceInput
): Promise<{ success?: boolean; invoice_id?: string; error?: string }> {
  try {
    const { error: authError, supabase, doctor } = await requireDoctor();
    if (authError || !supabase || !doctor) {
      return { error: authError || "Authentication failed" };
    }

    if (!doctor.stripe_account_id || !doctor.stripe_onboarding_complete) {
      return { error: "Please complete your payment setup before sending invoices." };
    }

    if (!input.items || input.items.length === 0) {
      return { error: "At least one line item is required." };
    }

    for (const item of input.items) {
      if (!item.name || item.price_cents < 100 || item.quantity < 1) {
        return { error: "Each item must have a name, price (min 1.00), and quantity." };
      }
    }

    // Calculate totals
    const subtotalCents = input.items.reduce(
      (sum, item) => sum + item.price_cents * item.quantity,
      0
    );

    let discountCents = 0;
    if (input.discount_type && input.discount_value && input.discount_value > 0) {
      if (input.discount_type === "percentage") {
        if (input.discount_value > 100) {
          return { error: "Percentage discount cannot exceed 100%." };
        }
        discountCents = Math.round((subtotalCents * input.discount_value) / 100);
      } else {
        discountCents = input.discount_value;
      }
    }

    const afterDiscount = Math.max(0, subtotalCents - discountCents);
    if (afterDiscount <= 0) {
      return { error: "Discount cannot make the total free." };
    }

    const platformFeeCents = getBookingFeeCents(doctor.base_currency);
    const totalCents = afterDiscount + platformFeeCents;

    // Generate invoice number
    const { data: seqResult } = await supabase.rpc("nextval_invoice_number");
    const seqNum = seqResult || Date.now();
    const invoiceNumber = `INV-${String(seqNum).padStart(5, "0")}`;

    // Due date
    const dueDays = input.due_days || 14;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);

    const { data: invoice, error: insertError } = await supabase
      .from("invoices")
      .insert({
        invoice_number: invoiceNumber,
        doctor_id: doctor.id,
        patient_id: input.patient_id,
        items: input.items,
        subtotal_cents: subtotalCents,
        discount_type: input.discount_type || null,
        discount_value: input.discount_value || null,
        discount_cents: discountCents,
        platform_fee_cents: platformFeeCents,
        total_cents: totalCents,
        currency: doctor.base_currency,
        status: "sent",
        due_date: dueDate.toISOString().split("T")[0],
        doctor_note: input.doctor_note || null,
      })
      .select("id, invoice_number")
      .single();

    if (insertError || !invoice) {
      console.error("Invoice insert error:", insertError);
      // If sequence-based number fails, try timestamp-based
      if (insertError?.code === "23505") {
        const fallbackNumber = `INV-${Date.now()}`;
        const { data: retryInvoice, error: retryError } = await supabase
          .from("invoices")
          .insert({
            invoice_number: fallbackNumber,
            doctor_id: doctor.id,
            patient_id: input.patient_id,
            items: input.items,
            subtotal_cents: subtotalCents,
            discount_type: input.discount_type || null,
            discount_value: input.discount_value || null,
            discount_cents: discountCents,
            platform_fee_cents: platformFeeCents,
            total_cents: totalCents,
            currency: doctor.base_currency,
            status: "sent",
            due_date: dueDate.toISOString().split("T")[0],
            doctor_note: input.doctor_note || null,
          })
          .select("id, invoice_number")
          .single();

        if (retryError || !retryInvoice) {
          return { error: "Failed to create invoice. Please try again." };
        }

        await sendInvoiceNotifications(supabase, doctor, retryInvoice, input, totalCents, dueDate);
        revalidatePath("/", "layout");
        return { success: true, invoice_id: retryInvoice.id };
      }
      return { error: "Failed to create invoice. Please try again." };
    }

    await sendInvoiceNotifications(supabase, doctor, invoice, input, totalCents, dueDate);

    revalidatePath("/", "layout");
    return { success: true, invoice_id: invoice.id };
  } catch (err) {
    console.error("createInvoice error:", err);
    return { error: "An unexpected error occurred." };
  }
}

async function sendInvoiceNotifications(
  supabase: any,
  doctor: any,
  invoice: { id: string; invoice_number: string },
  input: CreateInvoiceInput,
  totalCents: number,
  dueDate: Date
) {
  const { data: patient } = await supabase
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", input.patient_id)
    .single();

  if (!patient?.email) return;

  const { origin, locale } = await getOriginAndLocale();
  const profile: any = Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile;
  const doctorName = `${profile.first_name} ${profile.last_name}`;

  const itemsSummary = input.items
    .map((i) => `${i.name}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`)
    .join(", ");

  const { subject, html } = invoiceEmail({
    patientName: patient.first_name || "Patient",
    doctorName,
    invoiceNumber: invoice.invoice_number,
    items: itemsSummary,
    totalAmount: formatCurrency(totalCents, doctor.base_currency),
    dueDate: dueDate.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    invoiceUrl: `${origin}/${locale}/dashboard/invoices`,
    doctorNote: input.doctor_note || null,
  });

  sendEmail({ to: patient.email, subject, html }).catch((err) =>
    console.error("Invoice email error:", err)
  );

  createNotification({
    userId: input.patient_id,
    type: "invoice_received",
    title: "New Invoice",
    message: `Dr. ${doctorName} sent you invoice ${invoice.invoice_number} for ${formatCurrency(totalCents, doctor.base_currency)}`,
    channels: ["in_app"],
    metadata: { invoice_id: invoice.id },
  }).catch((err) => console.error("Invoice notification error:", err));
}

export async function createInvoiceCheckout(
  invoiceId: string
): Promise<{ url?: string | null; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "You must be logged in to pay this invoice." };

    const { data: invoice, error: invError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (invError || !invoice) return { error: "Invoice not found." };
    if (invoice.patient_id !== user.id) return { error: "This invoice is not addressed to you." };
    if (invoice.status === "paid") return { error: "This invoice has already been paid." };
    if (invoice.status === "cancelled") return { error: "This invoice has been cancelled." };

    const { data: doctor } = await supabase
      .from("doctors")
      .select(
        "id, stripe_account_id, stripe_onboarding_complete, profile:profiles!doctors_profile_id_fkey(first_name, last_name)"
      )
      .eq("id", invoice.doctor_id)
      .single();

    if (!doctor || !doctor.stripe_account_id || !doctor.stripe_onboarding_complete) {
      return { error: "Doctor payment setup is incomplete." };
    }

    const { origin, locale } = await getOriginAndLocale();
    const profile: any = Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile;
    const doctorName = `${profile.first_name} ${profile.last_name}`;

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: invoice.currency.toLowerCase(),
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: `Payment to Dr. ${doctorName}`,
            },
            unit_amount: invoice.total_cents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: invoice.platform_fee_cents,
        transfer_data: {
          destination: doctor.stripe_account_id,
        },
      },
      metadata: {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        type: "invoice_payment",
      },
      success_url: `${origin}/${locale}/dashboard/invoices?paid=${invoice.id}`,
      cancel_url: `${origin}/${locale}/dashboard/invoices`,
    });

    // Mark as viewed if first interaction
    if (invoice.status === "sent") {
      await supabase
        .from("invoices")
        .update({ status: "viewed" })
        .eq("id", invoiceId);
    }

    return { url: session.url };
  } catch (err) {
    console.error("createInvoiceCheckout error:", err);
    return { error: "An unexpected error occurred." };
  }
}

export async function cancelInvoice(
  invoiceId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { error: authError, supabase, doctor } = await requireDoctor();
    if (authError || !supabase || !doctor) {
      return { error: authError || "Authentication failed" };
    }

    const { data: invoice } = await supabase
      .from("invoices")
      .select("id, status")
      .eq("id", invoiceId)
      .eq("doctor_id", doctor.id)
      .single();

    if (!invoice) return { error: "Invoice not found." };
    if (invoice.status === "paid") return { error: "Cannot cancel a paid invoice." };

    await supabase
      .from("invoices")
      .update({ status: "cancelled" })
      .eq("id", invoiceId);

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    console.error("cancelInvoice error:", err);
    return { error: "An unexpected error occurred." };
  }
}

export async function getDoctorInvoices() {
  try {
    const { error: authError, supabase, doctor } = await requireDoctor();
    if (authError || !supabase || !doctor) {
      return { invoices: [], error: authError || "Authentication failed" };
    }

    const { data, error } = await supabase
      .from("invoices")
      .select(
        `*, patient:profiles!invoices_patient_id_fkey(first_name, last_name, email)`
      )
      .eq("doctor_id", doctor.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("getDoctorInvoices error:", error);
      return { invoices: [], error: "Failed to fetch invoices." };
    }

    return { invoices: data || [] };
  } catch (err) {
    console.error("getDoctorInvoices error:", err);
    return { invoices: [], error: "An unexpected error occurred." };
  }
}
