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
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Invoice Details" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DoctorInvoiceDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  // Get doctor record for the current user
  const { data: doctor } = await supabase
    .from("doctors")
    .select(
      "id, title, clinic_name, profile:profiles!doctors_profile_id_fkey(first_name, last_name, email)"
    )
    .eq("profile_id", user.id)
    .single();

  if (!doctor) redirect("/en/login");

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      `*,
       patient:profiles!invoices_patient_id_fkey(first_name, last_name, email)`
    )
    .eq("id", id)
    .eq("doctor_id", doctor.id)
    .single();

  if (!invoice) notFound();

  const doctorProfile: any = Array.isArray(doctor.profile)
    ? doctor.profile[0]
    : doctor.profile;
  const patient: any = Array.isArray(invoice.patient)
    ? invoice.patient[0]
    : invoice.patient;

  const doctorName = `${doctor.title || "Dr."} ${doctorProfile?.first_name || ""} ${doctorProfile?.last_name || ""}`.trim();
  const patientName = patient
    ? `${patient.first_name} ${patient.last_name}`
    : "Patient";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/doctor-dashboard/invoices">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Invoices
          </Link>
        </Button>
        <PrintButton className="print:hidden" label="Print" />
      </div>

      <InvoiceTemplate
        invoiceNumber={invoice.invoice_number}
        status={invoice.status}
        createdAt={invoice.created_at}
        dueDate={invoice.due_date}
        paidAt={invoice.paid_at}
        doctorName={doctorName}
        clinicName={doctor.clinic_name}
        doctorEmail={doctorProfile?.email}
        patientName={patientName}
        patientEmail={patient?.email}
        items={(invoice.items as InvoiceLineItem[]) || []}
        subtotalCents={invoice.subtotal_cents}
        discountCents={invoice.discount_cents || 0}
        discountType={invoice.discount_type}
        discountValue={invoice.discount_value}
        platformFeeCents={invoice.platform_fee_cents}
        totalCents={invoice.total_cents}
        currency={invoice.currency}
        doctorNote={invoice.doctor_note}
        viewAs="doctor"
      />
    </div>
  );
}
