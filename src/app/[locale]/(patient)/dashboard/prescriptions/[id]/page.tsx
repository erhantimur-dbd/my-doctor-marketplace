import { getPatientPrescriptionById } from "@/actions/prescriptions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ScrollText,
  ChevronLeft,
  Pill,
  User,
  Calendar,
  Printer,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

function statusColor(status: string) {
  switch (status) {
    case "active":
      return "default" as const;
    case "completed":
      return "secondary" as const;
    case "cancelled":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

export default async function PatientPrescriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const prescription = await getPatientPrescriptionById(id);

  if (!prescription) notFound();

  const doctor: any = Array.isArray(prescription.doctor)
    ? prescription.doctor[0]
    : prescription.doctor;
  const profile: any = doctor
    ? Array.isArray(doctor.profile)
      ? doctor.profile[0]
      : doctor.profile
    : null;
  const doctorName = profile
    ? `Dr. ${profile.first_name} ${profile.last_name}`
    : "Unknown Doctor";
  const meds = Array.isArray(prescription.medications)
    ? prescription.medications
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/dashboard/prescriptions">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to Prescriptions
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Prescription Details
            </h1>
            <p className="text-muted-foreground">
              Prescribed by {doctorName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusColor(prescription.status)} className="text-sm">
              {prescription.status}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={undefined}
              className="print-button"
            >
              <Printer className="mr-1 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Doctor & Date Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Prescribing Doctor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{doctorName}</p>
            {doctor?.slug && (
              <Link
                href={`/doctors/${doctor.slug}`}
                className="text-sm text-primary hover:underline"
              >
                View Profile
              </Link>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              Prescription Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">
              {new Date(prescription.prescribed_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            {prescription.valid_until && (
              <p className="text-sm text-muted-foreground">
                Valid until:{" "}
                {new Date(prescription.valid_until).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Diagnosis */}
      {prescription.diagnosis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="h-4 w-4" />
              Diagnosis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{prescription.diagnosis}</p>
          </CardContent>
        </Card>
      )}

      {/* Medications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Pill className="h-4 w-4" />
            Medications ({meds.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {meds.map((med: any, i: number) => (
              <div key={i} className="rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <h4 className="font-semibold">{med.name}</h4>
                  {med.dosage && (
                    <Badge variant="outline">{med.dosage}</Badge>
                  )}
                </div>
                <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                  {med.frequency && (
                    <p>
                      <span className="font-medium text-foreground">
                        Frequency:
                      </span>{" "}
                      {med.frequency}
                    </p>
                  )}
                  {med.duration && (
                    <p>
                      <span className="font-medium text-foreground">
                        Duration:
                      </span>{" "}
                      {med.duration}
                    </p>
                  )}
                  {med.instructions && (
                    <p>
                      <span className="font-medium text-foreground">
                        Instructions:
                      </span>{" "}
                      {med.instructions}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      {prescription.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Additional Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-muted-foreground">
              {prescription.notes}
            </p>
          </CardContent>
        </Card>
      )}

      {/* NHS-GP banner — Workstream 3.1 of the UK CQC compliance plan.
          This is a private prescription issued through the MyDoctors360
          platform. Patients must be advised to inform their NHS GP so the
          treatment is visible to the rest of their care team. */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-100">
        <p className="font-medium">
          This prescription was issued privately by {doctorName} through
          MyDoctors360.
        </p>
        <p className="mt-1">
          You should inform your NHS GP about any medicines you receive
          privately so your full clinical picture is on record with your NHS
          care team. Bring a copy of this prescription to your next GP
          appointment, or send it via your GP practice&rsquo;s secure
          messaging.
        </p>
      </div>

      {/* Disclaimer */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        <p className="font-medium">Important</p>
        <p className="mt-1">
          This prescription is for informational purposes. Always consult with
          your pharmacist and follow the instructions provided by your doctor.
          If you experience any side effects, contact your doctor immediately.
        </p>
      </div>
    </div>
  );
}
