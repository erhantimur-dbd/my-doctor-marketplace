import { getPatientPrescriptions } from "@/actions/prescriptions";
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
import { ScrollText, Eye, Pill } from "lucide-react";
import Link from "next/link";

function statusColor(status: string) {
  switch (status) {
    case "active":
      return "default";
    case "completed":
      return "secondary";
    case "cancelled":
      return "destructive";
    default:
      return "outline";
  }
}

export default async function PatientPrescriptionsPage() {
  const prescriptions = await getPatientPrescriptions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Prescriptions</h1>
        <p className="text-muted-foreground">
          View prescriptions from your doctors
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Prescriptions ({prescriptions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {prescriptions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Pill className="mx-auto mb-3 h-10 w-10 opacity-50" />
              <p>No prescriptions yet</p>
              <p className="text-sm">
                Your prescriptions will appear here after your doctor writes one
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead>Medications</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prescriptions.map((rx: any) => {
                  const doctor: any = Array.isArray(rx.doctor)
                    ? rx.doctor[0]
                    : rx.doctor;
                  const profile: any = doctor
                    ? Array.isArray(doctor.profile)
                      ? doctor.profile[0]
                      : doctor.profile
                    : null;
                  const doctorName = profile
                    ? `Dr. ${profile.first_name} ${profile.last_name}`
                    : "Unknown Doctor";
                  const meds = Array.isArray(rx.medications)
                    ? rx.medications
                    : [];

                  return (
                    <TableRow key={rx.id}>
                      <TableCell className="font-medium">
                        {doctorName}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {rx.diagnosis || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {meds.slice(0, 2).map((med: any, i: number) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {med.name}
                            </Badge>
                          ))}
                          {meds.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{meds.length - 2} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColor(rx.status)}>
                          {rx.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(rx.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/prescriptions/${rx.id}`}>
                            <Eye className="mr-1 h-4 w-4" />
                            View
                          </Link>
                        </Button>
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
