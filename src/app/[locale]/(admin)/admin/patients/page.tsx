import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Eye, Users } from "lucide-react";
import { PatientFilters } from "./patient-filters";
import { ExportCSVButton } from "../components/export-csv-button";
import { exportPatientsCSV } from "@/actions/admin";

export default async function AdminPatientsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    sort?: string;
  }>;
}) {
  const { q, sort } = await searchParams;

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

  const { data: allPatients } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, email, phone, avatar_url, city, country, created_at"
    )
    .eq("role", "patient")
    .order("created_at", { ascending: sort === "oldest" });

  // Get booking counts per patient
  const patientIds = (allPatients || []).map((p: any) => p.id);
  const bookingCounts = new Map<string, number>();

  if (patientIds.length > 0) {
    const { data: bookingData } = await supabase
      .from("bookings")
      .select("patient_id")
      .in("patient_id", patientIds);

    if (bookingData) {
      bookingData.forEach((b: any) => {
        bookingCounts.set(
          b.patient_id,
          (bookingCounts.get(b.patient_id) || 0) + 1
        );
      });
    }
  }

  // Apply text search
  let patients = allPatients || [];
  if (q) {
    const lowerQ = q.toLowerCase();
    patients = patients.filter((p: any) => {
      const name = `${p.first_name || ""} ${p.last_name || ""}`.toLowerCase();
      const email = (p.email || "").toLowerCase();
      const phone = (p.phone || "").toLowerCase();
      return name.includes(lowerQ) || email.includes(lowerQ) || phone.includes(lowerQ);
    });
  }

  // Sort by most bookings
  if (sort === "most_bookings") {
    patients = [...patients].sort(
      (a: any, b: any) => (bookingCounts.get(b.id) || 0) - (bookingCounts.get(a.id) || 0)
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-purple-600" />
          <h1 className="text-2xl font-bold">Patient Management</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {patients.length} patient{patients.length !== 1 ? "s" : ""}
          </span>
          <ExportCSVButton action={exportPatientsCSV} filename="patients-export.csv" />
        </div>
      </div>

      <PatientFilters />

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Bookings</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {patients.map((patient: any) => (
                <TableRow key={patient.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {patient.avatar_url && (
                          <AvatarImage src={patient.avatar_url} />
                        )}
                        <AvatarFallback>
                          {patient.first_name?.[0]}
                          {patient.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">
                        {patient.first_name} {patient.last_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {patient.email}
                  </TableCell>
                  <TableCell className="text-sm">
                    {patient.phone || "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {patient.city && patient.country
                      ? `${patient.city}, ${patient.country}`
                      : patient.city || patient.country || "-"}
                  </TableCell>
                  <TableCell className="text-sm font-medium">
                    {bookingCounts.get(patient.id) || 0}
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(patient.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/patients/${patient.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {patients.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-muted-foreground"
                  >
                    {q ? "No patients match the current search" : "No patients registered yet"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
