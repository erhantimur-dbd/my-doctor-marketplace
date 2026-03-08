import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Receipt, CreditCard, Clock, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { InvoicePayButton } from "./invoice-pay-button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invoices | MyDoctors360",
};

function statusBadge(status: string) {
  switch (status) {
    case "paid":
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Paid</Badge>;
    case "sent":
    case "viewed":
      return <Badge variant="outline">Pending</Badge>;
    case "overdue":
      return <Badge variant="destructive">Overdue</Badge>;
    case "cancelled":
      return <Badge variant="secondary">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  const params = await searchParams;

  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      `*, doctor:doctors!invoices_doctor_id_fkey(
        id, clinic_name,
        profile:profiles!doctors_profile_id_fkey(first_name, last_name)
      )`
    )
    .eq("patient_id", user.id)
    .order("created_at", { ascending: false });

  const allInvoices = (invoices || []) as any[];

  // Stats
  const pendingInvoices = allInvoices.filter((inv) =>
    ["sent", "viewed", "overdue"].includes(inv.status)
  );
  const paidInvoices = allInvoices.filter((inv) => inv.status === "paid");
  const totalOwed = pendingInvoices.reduce(
    (sum: number, inv: any) => sum + inv.total_cents,
    0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-muted-foreground">
          View and pay invoices from your doctors
        </p>
      </div>

      {/* Paid success message */}
      {params.paid && (
        <Card className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/20">
          <CardContent className="flex items-center gap-3 p-4">
            <CreditCard className="h-5 w-5 text-green-600" />
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Payment received! Your invoice has been marked as paid.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-50 p-3">
              <Receipt className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Invoices</p>
              <p className="text-2xl font-bold">{allInvoices.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-amber-50 p-3">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{pendingInvoices.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-red-50 p-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Amount Due</p>
              <p className="text-2xl font-bold">
                {totalOwed > 0
                  ? formatCurrency(totalOwed, pendingInvoices[0]?.currency || "EUR")
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {allInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                No invoices yet. Invoices from your doctors will appear here.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allInvoices.map((invoice: any) => {
                  const doctor: any = Array.isArray(invoice.doctor)
                    ? invoice.doctor[0]
                    : invoice.doctor;
                  const profile: any = Array.isArray(doctor?.profile)
                    ? doctor.profile[0]
                    : doctor?.profile;

                  const itemsList = (invoice.items as any[]) || [];
                  const itemsSummary =
                    itemsList.length <= 2
                      ? itemsList.map((i: any) => i.name).join(", ")
                      : `${itemsList[0]?.name} + ${itemsList.length - 1} more`;

                  const isPayable = ["sent", "viewed", "overdue"].includes(
                    invoice.status
                  );

                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell>
                        {profile
                          ? `Dr. ${profile.first_name} ${profile.last_name}`
                          : "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {itemsSummary || "—"}
                      </TableCell>
                      <TableCell>
                        {new Date(invoice.due_date).toLocaleDateString(
                          "en-GB",
                          { day: "numeric", month: "short", year: "numeric" }
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.total_cents, invoice.currency)}
                      </TableCell>
                      <TableCell>{statusBadge(invoice.status)}</TableCell>
                      <TableCell className="text-right">
                        {isPayable && (
                          <InvoicePayButton invoiceId={invoice.id} />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
