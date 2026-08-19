import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { FeatureUnavailable } from "@/components/shared/feature-unavailable";
import { isPrescriptionsEnabled } from "@/lib/launch/soft-launch";
import { getDoctorPatients } from "@/actions/prescriptions";
import { PrescriptionForm } from "@/components/doctor/prescription-form";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

export default async function NewPrescriptionPage() {
  if (!isPrescriptionsEnabled()) {
    return (
      <FeatureUnavailable
        title="Prescriptions unavailable"
        description="Prescriptions are disabled for this launch."
      />
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!doctor) redirect("/en/register-doctor");

  const patients = await getDoctorPatients();

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/doctor-dashboard/prescriptions">
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to Prescriptions
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">
          New Prescription
        </h1>
        <p className="text-muted-foreground">
          Create a prescription for one of your patients
        </p>
      </div>

      {patients.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          <p className="text-lg font-medium">No patients found</p>
          <p className="mt-1 text-sm">
            You need at least one completed booking before you can write a
            prescription.
          </p>
        </div>
      ) : (
        <PrescriptionForm patients={patients} />
      )}
    </div>
  );
}
