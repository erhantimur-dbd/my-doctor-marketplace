import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClipboardList, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { Link } from "@/i18n/navigation";
import { UpgradePrompt } from "@/components/shared/upgrade-prompt";

const STATUS_STYLES: Record<string, { label: string; variant: string; className: string }> = {
  sent: {
    label: "Sent",
    variant: "outline",
    className: "border-blue-200 bg-blue-50 text-blue-700",
  },
  accepted: {
    label: "Accepted",
    variant: "outline",
    className: "border-green-200 bg-green-50 text-green-700",
  },
  in_progress: {
    label: "In Progress",
    variant: "outline",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  completed: {
    label: "Completed",
    variant: "outline",
    className: "border-green-200 bg-green-50 text-green-700",
  },
  cancelled: {
    label: "Cancelled",
    variant: "outline",
    className: "border-red-200 bg-red-50 text-red-700",
  },
  expired: {
    label: "Expired",
    variant: "outline",
    className: "border-gray-200 bg-gray-50 text-gray-500",
  },
};

export default async function TreatmentPlansPage() {
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

  const { data: subscription } = await supabase
    .from("doctor_subscriptions")
    .select("id")
    .eq("doctor_id", doctor.id)
    .in("status", ["active", "trialing", "past_due"])
    .limit(1)
    .maybeSingle();

  if (!subscription) {
    return <UpgradePrompt feature="Treatment Plans" />;
  }

  const { data: plans } = await supabase
    .from("treatment_plans")
    .select(
      `
      id, title, total_sessions, sessions_completed, payment_type, status, unit_price_cents, currency, created_at,
      patient:profiles!treatment_plans_patient_id_fkey(first_name, last_name, avatar_url, email)
    `
    )
    .eq("doctor_id", doctor.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-2">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Treatment Plans</h1>
            <p className="text-muted-foreground">
              Create and manage treatment plans for your patients
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/doctor-dashboard/treatment-plans/new">
            <Plus className="mr-2 h-4 w-4" />
            New Plan
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Treatment Plans</CardTitle>
        </CardHeader>
        <CardContent>
          {!plans || plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardList className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                No treatment plans yet. Create your first plan.
              </p>
              <Button asChild className="mt-4">
                <Link href="/doctor-dashboard/treatment-plans/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Treatment Plan
                </Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Plan Title</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Payment Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan: any) => {
                  const patient: any = Array.isArray(plan.patient)
                    ? plan.patient[0]
                    : plan.patient;
                  const progressPercent =
                    plan.total_sessions > 0
                      ? Math.round(
                          (plan.sessions_completed / plan.total_sessions) * 100
                        )
                      : 0;
                  const statusStyle = STATUS_STYLES[plan.status] || STATUS_STYLES.sent;

                  return (
                    <TableRow key={plan.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            {patient?.avatar_url ? (
                              <AvatarImage
                                src={patient.avatar_url}
                                alt={`${patient?.first_name || ""} ${patient?.last_name || ""}`}
                              />
                            ) : null}
                            <AvatarFallback className="text-xs">
                              {(patient?.first_name || "?").charAt(0)}
                              {(patient?.last_name || "?").charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-medium">
                              {patient?.first_name || "Unknown"}{" "}
                              {patient?.last_name || ""}
                            </span>
                            <p className="text-xs text-muted-foreground">
                              {patient?.email || ""}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-medium">{plan.title}</span>
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(
                              plan.unit_price_cents,
                              plan.currency
                            )}{" "}
                            / session
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <span className="text-sm">
                            {plan.sessions_completed} / {plan.total_sessions}{" "}
                            completed
                          </span>
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-primary transition-all"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            plan.payment_type === "pay_full"
                              ? "bg-purple-50 text-purple-700"
                              : "bg-sky-50 text-sky-700"
                          }
                        >
                          {plan.payment_type === "pay_full"
                            ? "Pay Full"
                            : "Pay Per Visit"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={statusStyle.className}
                        >
                          {statusStyle.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(plan.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
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
