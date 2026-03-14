import { getDoctorPrescriptionById, cancelPrescription } from "@/actions/prescriptions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ScrollText,
  ChevronLeft,
  Pill,
  User,
  Calendar,
  Clock,
  Printer,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrescriptionActions } from "@/components/doctor/prescription-actions";

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

export default async function DoctorPrescriptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const prescription = await getDoctorPrescriptionById(id);

  if (!prescription) notFound();

  const patient: any = Array.isArray(prescription.patient)
    ? prescription.patient[0]
    : prescription.patient;
  const patientName = patient
    ? `${patient.first_name} ${patient.last_name}`
    : "Unknown Patient";
  const meds = Array.isArray(prescription.medications)
    ? prescription.medications
    : [];

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/doctor-dashboard/prescriptions">
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
              Prescription for {patientName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusColor(prescription.status)} className="text-sm">
              {prescription.status}
            </Badge>
            <PrescriptionActions
              prescriptionId={prescription.id}
              status={prescription.status}
            />
          </div>
        </div>
      </div>

      {/* Patient & Date Info */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Patient
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{patientName}</p>
            {patient?.date_of_birth && (
              <p className="text-sm text-muted-foreground">
                DOB: {new Date(patient.date_of_birth).toLocaleDateString("en-GB")}
              </p>
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
    </div>
  );
}
