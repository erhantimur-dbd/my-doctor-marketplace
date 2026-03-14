"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod/v4";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const medicationSchema = z.object({
  name: z.string().min(1).max(200),
  dosage: z.string().max(100).nullish(),
  frequency: z.string().max(100).nullish(),
  duration: z.string().max(100).nullish(),
  instructions: z.string().max(500).nullish(),
});

const prescriptionSchema = z.object({
  patient_id: z.string().uuid(),
  booking_id: z.string().uuid().nullish(),
  diagnosis: z.string().max(2000).nullish(),
  medications: z.array(medicationSchema).min(1),
  notes: z.string().max(2000).nullish(),
  valid_until: z.string().nullish(),
});

export type MedicationInput = z.infer<typeof medicationSchema>;
export type PrescriptionInput = z.infer<typeof prescriptionSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getDoctorId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();
  return doctor?.id || null;
}

// ─── Doctor actions ──────────────────────────────────────────────────────────

/**
 * Create a new prescription (doctor only).
 */
export async function createPrescription(input: PrescriptionInput) {
  const parsed = prescriptionSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const doctorId = await getDoctorId();
  if (!doctorId) return { error: "Not authenticated as doctor" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prescriptions")
    .insert({
      doctor_id: doctorId,
      patient_id: parsed.data.patient_id,
      booking_id: parsed.data.booking_id || null,
      diagnosis: parsed.data.diagnosis || null,
      medications: parsed.data.medications,
      notes: parsed.data.notes || null,
      valid_until: parsed.data.valid_until || null,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { success: true, id: data.id };
}

/**
 * Update a prescription (doctor only).
 */
export async function updatePrescription(
  prescriptionId: string,
  input: Partial<PrescriptionInput>
) {
  const doctorId = await getDoctorId();
  if (!doctorId) return { error: "Not authenticated as doctor" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("prescriptions")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", prescriptionId)
    .eq("doctor_id", doctorId);

  if (error) return { error: error.message };
  return { success: true };
}

/**
 * Cancel a prescription (doctor only).
 */
export async function cancelPrescription(prescriptionId: string) {
  const doctorId = await getDoctorId();
  if (!doctorId) return { error: "Not authenticated as doctor" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("prescriptions")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", prescriptionId)
    .eq("doctor_id", doctorId);

  if (error) return { error: error.message };
  return { success: true };
}

/**
 * Get prescriptions written by the current doctor.
 */
export async function getDoctorPrescriptions() {
  const doctorId = await getDoctorId();
  if (!doctorId) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("prescriptions")
    .select(
      `
      *,
      patient:profiles!prescriptions_patient_id_fkey(first_name, last_name, avatar_url),
      booking:bookings(consultation_type, appointment_date, start_time)
    `
    )
    .eq("doctor_id", doctorId)
    .order("created_at", { ascending: false });

  return data || [];
}

/**
 * Get a single prescription by ID (doctor view).
 */
export async function getDoctorPrescriptionById(prescriptionId: string) {
  const doctorId = await getDoctorId();
  if (!doctorId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("prescriptions")
    .select(
      `
      *,
      patient:profiles!prescriptions_patient_id_fkey(first_name, last_name, avatar_url, date_of_birth),
      booking:bookings(consultation_type, appointment_date, start_time)
    `
    )
    .eq("id", prescriptionId)
    .eq("doctor_id", doctorId)
    .single();

  return data;
}

// ─── Patient actions ─────────────────────────────────────────────────────────

/**
 * Get prescriptions for the current patient.
 */
export async function getPatientPrescriptions() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("prescriptions")
    .select(
      `
      *,
      doctor:doctors!prescriptions_doctor_id_fkey(
        id,
        slug,
        profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url)
      )
    `
    )
    .eq("patient_id", user.id)
    .order("created_at", { ascending: false });

  return data || [];
}

/**
 * Get a single prescription by ID (patient view).
 */
export async function getPatientPrescriptionById(prescriptionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("prescriptions")
    .select(
      `
      *,
      doctor:doctors!prescriptions_doctor_id_fkey(
        id,
        slug,
        profile:profiles!doctors_profile_id_fkey(first_name, last_name, avatar_url)
      )
    `
    )
    .eq("id", prescriptionId)
    .eq("patient_id", user.id)
    .single();

  return data;
}

/**
 * Get patients for the current doctor (for the prescription form patient selector).
 */
export async function getDoctorPatients() {
  const doctorId = await getDoctorId();
  if (!doctorId) return [];

  const supabase = await createClient();
  // Get unique patients from completed bookings
  const { data } = await supabase
    .from("bookings")
    .select(
      `
      patient_id,
      patient:profiles!bookings_patient_id_fkey(first_name, last_name, avatar_url)
    `
    )
    .eq("doctor_id", doctorId)
    .eq("status", "completed")
    .order("appointment_date", { ascending: false });

  if (!data) return [];

  // Deduplicate by patient_id
  const seen = new Set<string>();
  const patients: Array<{
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  }> = [];

  for (const row of data) {
    if (seen.has(row.patient_id)) continue;
    seen.add(row.patient_id);
    const patient: any = Array.isArray(row.patient)
      ? row.patient[0]
      : row.patient;
    if (patient) {
      patients.push({
        id: row.patient_id,
        first_name: patient.first_name,
        last_name: patient.last_name,
        avatar_url: patient.avatar_url,
      });
    }
  }

  return patients;
}
