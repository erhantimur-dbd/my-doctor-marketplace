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

export default async function AdminPatientsPage() {
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

  const { data: patients } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, email, phone, avatar_url, city, country, created_at"
    )
    .eq("role", "patient")
    .order("created_at", { ascending: false });

  // Get booking counts per patient
  const patientIds = (patients || []).map((p: any) => p.id);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-purple-600" />
          <h1 className="text-2xl font-bold">Patient Management</h1>
        </div>
        <span className="text-sm text-muted-foreground">
          {patients?.length || 0} total patients
        </span>
      </div>

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
              {patients?.map((patient: any) => (
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
              {(!patients || patients.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No patients registered yet
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
