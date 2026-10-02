import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import { CorrectionActions } from "./correction-actions";

export default async function PaymentCorrectionDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const { supabase } = await requireAdminPage(locale);

  const { data: row, error } = await supabase
    .from("payment_corrections")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return (
      <p className="text-sm text-muted-foreground">
        Apply migration 00124_payment_corrections.sql before opening a correction.
      </p>
    );
  }
  if (!row) notFound();

  const { data: events } = await supabase
    .from("payment_correction_events_read")
    .select("id, event_type, created_at, payload")
    .eq("correction_id", id)
    .order("created_at", { ascending: true });

  const { data: approvals } = await supabase
    .from("payment_correction_approvals")
    .select("approver_id, approved_at")
    .eq("correction_id", id);

  return (
    <div className="space-y-6">
      <Link href="/admin/payment-corrections" className="text-sm text-muted-foreground">
        Back to corrections
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">
          {formatCurrency(row.amount_cents, row.currency)}
        </h1>
        <Badge>{row.status}</Badge>
        {row.our_error ? <Badge variant="outline">our error</Badge> : null}
        {row.clear_risk ? <Badge variant="destructive">clear risk</Badge> : null}
      </div>
      <p>{row.reason}</p>
      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>Party: {row.party}</div>
        <div>Direction: {row.direction}</div>
        <div>Error type: {row.error_type}</div>
        <div>Required approvals: {row.required_approvals}</div>
        <div>Notice sent: {row.notice_sent_at || "not yet"}</div>
        <div>Earliest recovery: {row.earliest_recovery_at || "—"}</div>
        <div>Dispute: {row.disputed_at ? "open or recorded" : "none"}</div>
        <div>Statement: {row.statement_line}</div>
      </dl>
      <section>
        <h2 className="font-medium">Approvals ({(approvals || []).length})</h2>
        <ul className="text-sm text-muted-foreground">
          {(approvals || []).map((approval) => (
            <li key={approval.approver_id}>
              {approval.approver_id} at {approval.approved_at}
            </li>
          ))}
        </ul>
      </section>
      <CorrectionActions
        correctionId={row.id}
        party={row.party}
        ourError={Boolean(row.our_error)}
        errorType={row.error_type}
      />
      <section>
        <h2 className="font-medium">Events</h2>
        <ul className="space-y-1 text-sm">
          {(events || []).map((event) => (
            <li key={event.id}>
              {event.created_at} — {event.event_type}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
