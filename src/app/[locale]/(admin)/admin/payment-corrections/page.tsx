import { Link } from "@/i18n/navigation";
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils/currency";

export default async function PaymentCorrectionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { supabase } = await requireAdminPage(locale);

  const { data, error } = await supabase
    .from("payment_corrections")
    .select(
      "id, created_at, party, direction, amount_cents, currency, status, error_type, our_error, reason"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payment corrections</h1>
          <p className="text-muted-foreground">
            Flag a payment error, then a named approver authorises any money movement.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/payment-corrections/new">New correction</Link>
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-muted-foreground">
          Corrections are not available yet. Apply migration 00124_payment_corrections.sql, then seed payment_correction_approvers.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Party</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data || []).map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link href={`/admin/payment-corrections/${row.id}`} className="underline">
                    {new Date(row.created_at).toLocaleDateString("en-GB")}
                  </Link>
                </TableCell>
                <TableCell className="capitalize">{row.party}</TableCell>
                <TableCell>{row.direction}</TableCell>
                <TableCell>{formatCurrency(row.amount_cents, row.currency)}</TableCell>
                <TableCell>
                  {row.error_type}
                  {row.our_error ? (
                    <Badge className="ml-2" variant="outline">
                      our error
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>{row.status}</TableCell>
              </TableRow>
            ))}
            {(data || []).length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No corrections yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
