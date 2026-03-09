import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import {
  ClipboardCheck,
  ArrowRight,
  ShieldAlert,
  Clock,
  ExternalLink,
} from "lucide-react";

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/en/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/en");

  // Fetch pending and under_review doctors — oldest first (FIFO queue)
  const { data: pendingDoctors } = await supabase
    .from("doctors")
    .select(
      `id, gmc_number, verification_status, created_at, slug, website,
       profile:profiles!doctors_profile_id_fkey(first_name, last_name, email, created_at)`
    )
    .in("verification_status", ["pending", "under_review"])
    .order("created_at", { ascending: true });

  const doctors = (pendingDoctors || []) as any[];

  // Fetch checklists for these doctors to show progress
  const doctorIds = doctors.map((d) => d.id);
  let checklistMap = new Map<string, { gmc_verified: boolean; website_verified: boolean }>();

  if (doctorIds.length > 0) {
    const { data: checklists } = await supabase
      .from("doctor_approval_checklist")
      .select("doctor_id, gmc_verified, website_verified")
      .in("doctor_id", doctorIds);

    if (checklists) {
      checklistMap = new Map(
        checklists.map((c: any) => [
          c.doctor_id,
          { gmc_verified: c.gmc_verified, website_verified: c.website_verified },
        ])
      );
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Doctor Approvals</h1>
          <p className="text-muted-foreground">
            Review and verify doctor registrations
          </p>
        </div>
        <Badge variant="secondary" className="gap-1 text-sm">
          <ShieldAlert className="h-4 w-4" />
          {doctors.length} awaiting approval
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Approval Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          {doctors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardCheck className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-muted-foreground">
                No doctors awaiting approval at this time.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>GMC Number</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Checklist</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doctors.map((doctor) => {
                  const p = Array.isArray(doctor.profile)
                    ? doctor.profile[0]
                    : doctor.profile;
                  const checklist = checklistMap.get(doctor.id);
                  const checksComplete = checklist
                    ? (checklist.gmc_verified ? 1 : 0) +
                      (checklist.website_verified ? 1 : 0)
                    : 0;

                  return (
                    <TableRow key={doctor.id}>
                      <TableCell className="font-medium">
                        {p?.first_name} {p?.last_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p?.email}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            {doctor.gmc_number || "—"}
                          </span>
                          {doctor.gmc_number && (
                            <a
                              href="https://www.gmc-uk.org/registration-and-licensing/the-medical-register"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(
                            p?.created_at || doctor.created_at
                          ).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            doctor.verification_status === "under_review"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {doctor.verification_status === "under_review"
                            ? "Under Review"
                            : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {checksComplete}/2 checks
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/doctors/${doctor.id}`}>
                          <Button variant="outline" size="sm">
                            Review
                            <ArrowRight className="ml-1 h-4 w-4" />
                          </Button>
                        </Link>
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
