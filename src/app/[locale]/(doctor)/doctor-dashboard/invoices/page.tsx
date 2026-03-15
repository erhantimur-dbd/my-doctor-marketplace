import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Receipt, FileText, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { UpgradePrompt } from "@/components/shared/upgrade-prompt";
import { hasActiveLicense } from "@/lib/license/check";
import { getDoctorInvoices } from "@/actions/invoices";
import { CancelInvoiceButton } from "./cancel-invoice-button";

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  sent: { label: "Sent", variant: "outline" },
  viewed: { label: "Viewed", variant: "default" },
  paid: { label: "Paid", variant: "secondary" },
  expired: { label: "Expired", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

const statusColorClass: Record<string, string> = {
  sent: "border-yellow-300 bg-yellow-50 text-yellow-700",
  viewed: "border-blue-300 bg-blue-50 text-blue-700",
  paid: "border-green-300 bg-green-50 text-green-700",
  expired: "border-gray-300 bg-gray-50 text-gray-700",
  cancelled: "border-red-300 bg-red-50 text-red-700",
};

export default async function InvoicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, base_currency")
    .eq("profile_id", user.id)
    .single();

  if (!doctor) redirect("/en/register-doctor");

  if (!(await hasActiveLicense(supabase, doctor.id))) {
    return <UpgradePrompt feature="Invoices" />;
  }

  const { invoices } = await getDoctorInvoices();

  // Stats
  const totalInvoices = invoices.length;
  const pendingInvoices = invoices.filter(
    (inv: any) => inv.status === "sent" || inv.status === "viewed"
  ).length;
  const revenueCollected = invoices
    .filter((inv: any) => inv.status === "paid")
    .reduce((sum: number, inv: any) => sum + inv.total_cents, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Invoices</h1>
        <p className="text-muted-foreground">
          Track and manage invoices sent to your patients
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-50 p-3">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Invoices</p>
              <p className="text-2xl font-bold">{totalInvoices}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-yellow-50 p-3">
              <Receipt className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{pendingInvoices}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-50 p-3">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Revenue Collected</p>
              <p className="text-2xl font-bold">
                {formatCurrency(revenueCollected, doctor.base_currency)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice List</CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Receipt className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                No invoices yet. Create an invoice from the Patients page.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice: any) => {
                  const patient: any = Array.isArray(invoice.patient)
                    ? invoice.patient[0]
                    : invoice.patient;

                  // Parse items JSONB
                  const items: { name: string }[] = Array.isArray(invoice.items)
                    ? invoice.items
                    : [];
                  const serviceNames = items.map((i) => i.name).join(", ");
                  const truncatedServices =
                    serviceNames.length > 40
                      ? serviceNames.slice(0, 37) + "..."
                      : serviceNames;

                  const canCancel =
                    invoice.status !== "paid" && invoice.status !== "cancelled";

                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell>
                        {patient
                          ? `${patient.first_name} ${patient.last_name}`
                          : "Unknown"}
                      </TableCell>
                      <TableCell
                        className="max-w-[200px] truncate text-muted-foreground"
                        title={serviceNames}
                      >
                        {truncatedServices || "-"}
                      </TableCell>
                      <TableCell>
                        {new Date(invoice.due_date).toLocaleDateString(
                          "en-GB",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(
                          invoice.total_cents,
                          invoice.currency || doctor.base_currency
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            statusConfig[invoice.status]?.variant || "outline"
                          }
                          className={
                            statusColorClass[invoice.status] || ""
                          }
                        >
                          {statusConfig[invoice.status]?.label ||
                            invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canCancel && (
                          <CancelInvoiceButton invoiceId={invoice.id} />
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
