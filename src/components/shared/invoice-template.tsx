import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils/currency";

export interface InvoiceLineItem {
  name: string;
  price_cents: number;
  quantity: number;
}

export interface InvoiceTemplateProps {
  invoiceNumber: string;
  status: string;
  createdAt: string;
  dueDate: string;
  paidAt?: string | null;
  doctorName: string;
  clinicName?: string | null;
  doctorEmail?: string | null;
  patientName: string;
  patientEmail?: string | null;
  items: InvoiceLineItem[];
  subtotalCents: number;
  discountCents: number;
  discountType?: string | null;
  discountValue?: number | null;
  platformFeeCents: number;
  totalCents: number;
  currency: string;
  doctorNote?: string | null;
  /** "patient" hides platform fee breakdown; "doctor" shows all */
  viewAs: "patient" | "doctor";
}

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "paid":
      return "default";
    case "sent":
    case "viewed":
      return "secondary";
    case "overdue":
    case "expired":
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

export function InvoiceTemplate({
  invoiceNumber,
  status,
  createdAt,
  dueDate,
  paidAt,
  doctorName,
  clinicName,
  doctorEmail,
  patientName,
  patientEmail,
  items,
  subtotalCents,
  discountCents,
  discountType,
  discountValue,
  platformFeeCents,
  totalCents,
  currency,
  doctorNote,
  viewAs,
}: InvoiceTemplateProps) {
  const cur = currency || "EUR";

  return (
    <Card className="max-w-2xl mx-auto print:shadow-none print:border-0">
      <CardContent className="p-8 print:p-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Invoice</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {invoiceNumber}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-primary">MyDoctors360</p>
            <Badge variant={statusBadgeVariant(status)} className="mt-1 capitalize">
              {status}
            </Badge>
          </div>
        </div>

        <Separator className="my-6" />

        {/* From / To */}
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              From
            </p>
            <p className="mt-1 font-medium">{doctorName}</p>
            {clinicName && (
              <p className="text-sm text-muted-foreground">{clinicName}</p>
            )}
            {doctorEmail && viewAs === "doctor" && (
              <p className="text-sm text-muted-foreground">{doctorEmail}</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              To
            </p>
            <p className="mt-1 font-medium">{patientName}</p>
            {patientEmail && viewAs === "doctor" && (
              <p className="text-sm text-muted-foreground">{patientEmail}</p>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Issued
            </p>
            <p className="mt-1 text-sm">
              {new Date(createdAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Due Date
            </p>
            <p className="mt-1 text-sm">
              {new Date(dueDate).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          {paidAt && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Paid
              </p>
              <p className="mt-1 text-sm">
                {new Date(paidAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          )}
        </div>

        <Separator className="my-6" />

        {/* Line Items */}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="pb-2 font-medium">Description</th>
              <th className="pb-2 font-medium text-center">Qty</th>
              <th className="pb-2 font-medium text-right">Unit Price</th>
              <th className="pb-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-3">{item.name}</td>
                <td className="py-3 text-center">{item.quantity}</td>
                <td className="py-3 text-right">
                  {formatCurrency(item.price_cents, cur)}
                </td>
                <td className="py-3 text-right font-medium">
                  {formatCurrency(item.price_cents * item.quantity, cur)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(subtotalCents, cur)}</span>
          </div>
          {discountCents > 0 && (
            <div className="flex justify-between text-green-600">
              <span>
                Discount
                {discountType === "percentage" && discountValue
                  ? ` (${discountValue}%)`
                  : ""}
              </span>
              <span>-{formatCurrency(discountCents, cur)}</span>
            </div>
          )}
          {viewAs === "doctor" && platformFeeCents > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Platform Fee</span>
              <span>{formatCurrency(platformFeeCents, cur)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span>{formatCurrency(totalCents, cur)}</span>
          </div>
        </div>

        {/* Doctor Note */}
        {doctorNote && (
          <div className="mt-6 rounded-md bg-muted/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Note from Doctor
            </p>
            <p className="text-sm whitespace-pre-wrap">{doctorNote}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-muted-foreground print:mt-12">
          <p>Powered by MyDoctors360 — Premium Private Healthcare Marketplace</p>
        </div>
      </CardContent>
    </Card>
  );
}
