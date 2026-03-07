import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TreatmentPlanWizard } from "./wizard";

export default async function NewTreatmentPlanPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/en/login");

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, base_currency, stripe_account_id, stripe_onboarding_complete")
    .eq("profile_id", user.id)
    .single();
  if (!doctor) redirect("/en/register-doctor");

  // Check subscription
  const { data: subscription } = await supabase
    .from("doctor_subscriptions")
    .select("id")
    .eq("doctor_id", doctor.id)
    .in("status", ["active", "trialing", "past_due"])
    .limit(1)
    .maybeSingle();

  if (!subscription) {
    redirect("/doctor-dashboard");
  }

  // Fetch services
  const { data: services } = await supabase
    .from("doctor_services")
    .select("id, name, price_cents, duration_minutes, consultation_type")
    .eq("doctor_id", doctor.id)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  // Fetch patients (from completed bookings)
  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "patient_id, patient:profiles!bookings_patient_id_fkey(id, first_name, last_name, email, avatar_url)"
    )
    .eq("doctor_id", doctor.id)
    .in("status", ["confirmed", "approved", "completed"]);

  // Deduplicate patients
  const patientMap = new Map();
  (bookings || []).forEach((b: any) => {
    const p = Array.isArray(b.patient) ? b.patient[0] : b.patient;
    if (p && !patientMap.has(p.id)) {
      patientMap.set(p.id, {
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        avatar_url: p.avatar_url,
      });
    }
  });
  const patients = Array.from(patientMap.values());

  return (
    <TreatmentPlanWizard
      doctorId={doctor.id}
      currency={doctor.base_currency}
      services={services || []}
      patients={patients}
      hasStripe={
        !!doctor.stripe_account_id && !!doctor.stripe_onboarding_complete
      }
    />
  );
}
