import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Search, User, Mail, Calendar } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { UpgradePrompt } from "@/components/shared/upgrade-prompt";

interface PatientRow {
  patient_id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  total_visits: number;
  last_visit: string;
  total_revenue: number;
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
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
    return <UpgradePrompt feature="Patient CRM" />;
  }

  const params = await searchParams;
  const searchQuery = params.q || "";

  // Fetch all bookings for this doctor with patient profiles
  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "patient_id, appointment_date, total_amount_cents, status, patient:profiles!bookings_patient_id_fkey(id, first_name, last_name, email, avatar_url)"
    )
    .eq("doctor_id", doctor.id)
    .in("status", ["confirmed", "approved", "completed"]);

  // Aggregate patient data
  const patientMap = new Map<string, PatientRow>();

  (bookings || []).forEach((booking: any) => {
    const existing = patientMap.get(booking.patient_id);
    if (existing) {
      existing.total_visits += 1;
      existing.total_revenue += booking.total_amount_cents;
      if (booking.appointment_date > existing.last_visit) {
        existing.last_visit = booking.appointment_date;
      }
    } else {
      patientMap.set(booking.patient_id, {
        patient_id: booking.patient_id,
        first_name: booking.patient.first_name,
        last_name: booking.patient.last_name,
        email: booking.patient.email,
        avatar_url: booking.patient.avatar_url,
        total_visits: 1,
        last_visit: booking.appointment_date,
        total_revenue: booking.total_amount_cents,
      });
    }
  });

  let patients = Array.from(patientMap.values()).sort(
    (a, b) => b.last_visit.localeCompare(a.last_visit)
  );

  // Apply search filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    patients = patients.filter(
      (p) =>
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q)
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Patients</h1>
        <p className="text-muted-foreground">
          View and manage your patient relationships
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-50 p-3">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Patients</p>
              <p className="text-2xl font-bold">{patientMap.size}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-50 p-3">
              <Calendar className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Visits</p>
              <p className="text-2xl font-bold">
                {Array.from(patientMap.values()).reduce(
                  (sum, p) => sum + p.total_visits,
                  0
                )}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-purple-50 p-3">
              <User className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Visits / Patient</p>
              <p className="text-2xl font-bold">
                {patientMap.size > 0
                  ? (
                      Array.from(patientMap.values()).reduce(
                        (sum, p) => sum + p.total_visits,
                        0
                      ) / patientMap.size
                    ).toFixed(1)
                  : "0"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Patient List</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="mb-6">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                placeholder="Search patients by name or email..."
                defaultValue={searchQuery}
                className="pl-10"
              />
            </div>
          </form>

          {patients.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {searchQuery
                  ? "No patients match your search"
                  : "No patients yet. Patients will appear here after their first booking."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Total Visits</TableHead>
                  <TableHead>Last Visit</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((patient) => (
                  <TableRow key={patient.patient_id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {patient.avatar_url ? (
                            <AvatarImage
                              src={patient.avatar_url}
                              alt={`${patient.first_name} ${patient.last_name}`}
                            />
                          ) : null}
                          <AvatarFallback className="text-xs">
                            {patient.first_name.charAt(0)}
                            {patient.last_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {patient.first_name} {patient.last_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {patient.email}
                      </div>
                    </TableCell>
                    <TableCell>{patient.total_visits}</TableCell>
                    <TableCell>
                      {new Date(patient.last_visit).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(
                        patient.total_revenue,
                        doctor.base_currency
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
