import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import {
  InvoiceTemplate,
  type InvoiceLineItem,
} from "@/components/shared/invoice-template";
import { PrintButton } from "@/components/shared/print-button";
import { InvoicePayButton } from "../invoice-pay-button";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Invoice" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PatientInvoiceDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      `*,
       doctor:doctors!invoices_doctor_id_fkey(
         title, clinic_name,
         profile:profiles!doctors_profile_id_fkey(first_name, last_name)
       )`
    )
    .eq("id", id)
    .eq("patient_id", user.id)
    .single();

  if (!invoice) notFound();

  const doctor: any = Array.isArray(invoice.doctor)
    ? invoice.doctor[0]
    : invoice.doctor;
  const doctorProfile: any = doctor
    ? Array.isArray(doctor.profile)
      ? doctor.profile[0]
      : doctor.profile
    : null;

  const { data: patientProfile } = await supabase
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", user.id)
    .single();

  const doctorName = `${doctor?.title || "Dr."} ${doctorProfile?.first_name || ""} ${doctorProfile?.last_name || ""}`.trim();
  const patientName = patientProfile
    ? `${patientProfile.first_name} ${patientProfile.last_name}`
    : "Patient";

  const canPay =
    invoice.status !== "paid" && invoice.status !== "cancelled";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/invoices">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Invoices
          </Link>
        </Button>
        <div className="flex gap-2">
          {canPay && (
            <InvoicePayButton invoiceId={invoice.id} />
          )}
          <PrintButton className="print:hidden" label="Print" />
        </div>
      </div>

      <InvoiceTemplate
        invoiceNumber={invoice.invoice_number}
        status={invoice.status}
        createdAt={invoice.created_at}
        dueDate={invoice.due_date}
        paidAt={invoice.paid_at}
        doctorName={doctorName}
        clinicName={doctor?.clinic_name}
        patientName={patientName}
        patientEmail={patientProfile?.email}
        items={(invoice.items as InvoiceLineItem[]) || []}
        subtotalCents={invoice.subtotal_cents}
        discountCents={invoice.discount_cents || 0}
        discountType={invoice.discount_type}
        discountValue={invoice.discount_value}
        platformFeeCents={invoice.platform_fee_cents}
        totalCents={invoice.total_cents}
        currency={invoice.currency}
        doctorNote={invoice.doctor_note}
        viewAs="patient"
      />
    </div>
  );
}
