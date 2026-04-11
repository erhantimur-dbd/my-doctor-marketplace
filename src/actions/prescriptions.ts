"use server";
import { safeError } from "@/lib/utils/safe-error";

import { headers } from "next/headers";
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

// Doctor attestation payload submitted alongside every new prescription.
// These three tickboxes are the platform's evidence that the doctor — not
// the platform — is the clinical decision-maker at the moment of issue.
// They are NOT stored on the prescriptions row; they land in the
// append-only `prescription_audit_log` attached to the 'issued' event.
// Part of Workstream 3.1 of the UK CQC compliance plan.
const attestationSchema = z.object({
  clinical_assessment: z.literal(true, {
    error:
      "You must confirm you have conducted an adequate clinical assessment before issuing a prescription.",
  }),
  remote_prescribing_considered: z.literal(true, {
    error:
      "You must confirm you have considered whether remote prescribing is appropriate (GMC guidance).",
  }),
});

const prescriptionSchema = z.object({
  patient_id: z.string().uuid(),
  booking_id: z.string().uuid().nullish(),
  diagnosis: z.string().max(2000).nullish(),
  medications: z.array(medicationSchema).min(1),
  notes: z.string().max(2000).nullish(),
  valid_until: z.string().nullish(),
  // Schedule 2/3/4/5 controlled drug flag + mandatory rationale when set.
  contains_controlled_drug: z.boolean().default(false),
  controlled_drug_justification: z.string().max(2000).nullish(),
  attestation: attestationSchema,
});

export type MedicationInput = z.infer<typeof medicationSchema>;
export type PrescriptionInput = z.infer<typeof prescriptionSchema>;

// Minimum character count for controlled-drug justifications at the
// application layer. The DB CHECK constraint enforces 20; we require a
// stricter 40 at the server action so the UI can surface a meaningful
// error before hitting the DB.
const CONTROLLED_DRUG_JUSTIFICATION_MIN = 40;

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
 *
 * The doctor must submit three attestations alongside the clinical data:
 *   1. Clinical assessment performed (GMC)
 *   2. Remote prescribing appropriateness considered (GMC)
 *   3. Controlled-drug status declared (Schedule 2/3/4/5); if set, a
 *      substantive clinical justification (>= 40 chars) is required.
 *
 * On success, an 'issued' event is written to the append-only
 * `prescription_audit_log` with the full payload, the attestations, the
 * request IP, and the user agent. This trail is deliberately created in
 * the same request so the audit row cannot drift from the prescription.
 *
 * Part of Workstream 3.1 of the UK CQC compliance plan.
 */
export async function createPrescription(input: PrescriptionInput) {
  const parsed = prescriptionSchema.safeParse(input);
  if (!parsed.success) {
    // Surface the first zod error so the form can highlight the offending
    // field — attestation errors have meaningful messages set on the
    // schema above.
    const firstIssue = parsed.error.issues[0];
    return {
      error: firstIssue?.message || "Invalid input",
    };
  }

  if (
    parsed.data.contains_controlled_drug &&
    (!parsed.data.controlled_drug_justification ||
      parsed.data.controlled_drug_justification.trim().length <
        CONTROLLED_DRUG_JUSTIFICATION_MIN)
  ) {
    return {
      error: `Controlled drug justification must be at least ${CONTROLLED_DRUG_JUSTIFICATION_MIN} characters and explain why remote prescribing is appropriate in this case.`,
    };
  }

  const doctorId = await getDoctorId();
  if (!doctorId) return { error: "Not authenticated as doctor" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const attestedAt = new Date().toISOString();

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
      contains_controlled_drug: parsed.data.contains_controlled_drug,
      controlled_drug_justification: parsed.data.contains_controlled_drug
        ? parsed.data.controlled_drug_justification?.trim() || null
        : null,
      attested_at: attestedAt,
    })
    .select("*")
    .single();

  if (error) return { error: safeError(error) };

  // Append-only audit log event. Failure here is non-blocking for the
  // patient-facing prescription (already written) but is logged and
  // surfaced so clinical governance can chase a missing audit row.
  try {
    const hdrs = await headers();
    const forwarded = hdrs.get("x-forwarded-for");
    const ipAddress =
      forwarded?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || null;
    const userAgent = hdrs.get("user-agent") || null;

    const { error: auditError } = await supabase
      .from("prescription_audit_log")
      .insert({
        prescription_id: data.id,
        event_type: "issued",
        actor_profile_id: user.id,
        ip_address: ipAddress,
        user_agent: userAgent,
        snapshot: data,
        attestations: {
          clinical_assessment: parsed.data.attestation.clinical_assessment,
          remote_prescribing_considered:
            parsed.data.attestation.remote_prescribing_considered,
          contains_controlled_drug: parsed.data.contains_controlled_drug,
          controlled_drug_justification: parsed.data.contains_controlled_drug
            ? parsed.data.controlled_drug_justification?.trim() || null
            : null,
          attested_at: attestedAt,
        },
      });
    if (auditError) {
      console.error(
        "[createPrescription] audit log insert failed",
        auditError
      );
    }
  } catch (err) {
    console.error("[createPrescription] audit log threw", err);
  }

  return { success: true, id: data.id };
}

/**
 * Update a prescription (doctor only).
 *
 * Updates are recorded on the append-only audit log so any subsequent
 * clinical review can see exactly what changed and when. Controlled-drug
 * flags cannot be toggled through this path — once issued, the CD status
 * is fixed and a change requires cancelling + re-issuing.
 */
export async function updatePrescription(
  prescriptionId: string,
  input: Partial<
    Pick<
      PrescriptionInput,
      | "diagnosis"
      | "medications"
      | "notes"
      | "valid_until"
      | "patient_id"
      | "booking_id"
    >
  >
) {
  const doctorId = await getDoctorId();
  if (!doctorId) return { error: "Not authenticated as doctor" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: updated, error } = await supabase
    .from("prescriptions")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", prescriptionId)
    .eq("doctor_id", doctorId)
    .select("*")
    .single();

  if (error || !updated) return { error: safeError(error) };

  await writePrescriptionAuditEvent({
    prescription: updated,
    eventType: "updated",
    actorProfileId: user.id,
  });

  return { success: true };
}

/**
 * Cancel a prescription (doctor only).
 */
export async function cancelPrescription(prescriptionId: string) {
  const doctorId = await getDoctorId();
  if (!doctorId) return { error: "Not authenticated as doctor" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: cancelled, error } = await supabase
    .from("prescriptions")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", prescriptionId)
    .eq("doctor_id", doctorId)
    .select("*")
    .single();

  if (error || !cancelled) return { error: safeError(error) };

  await writePrescriptionAuditEvent({
    prescription: cancelled,
    eventType: "cancelled",
    actorProfileId: user.id,
  });

  return { success: true };
}

/**
 * Shared helper to append a row to the immutable prescription audit log
 * for update/cancel events. Issue events are written inline in
 * createPrescription() because the attestation snapshot lives on a
 * zod-parsed object that isn't available here.
 */
async function writePrescriptionAuditEvent({
  prescription,
  eventType,
  actorProfileId,
}: {
  prescription: Record<string, unknown>;
  eventType: "updated" | "cancelled";
  actorProfileId: string;
}) {
  try {
    const supabase = await createClient();
    const hdrs = await headers();
    const forwarded = hdrs.get("x-forwarded-for");
    const ipAddress =
      forwarded?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || null;
    const userAgent = hdrs.get("user-agent") || null;

    const { error } = await supabase.from("prescription_audit_log").insert({
      prescription_id: prescription.id as string,
      event_type: eventType,
      actor_profile_id: actorProfileId,
      ip_address: ipAddress,
      user_agent: userAgent,
      snapshot: prescription,
      attestations: null,
    });
    if (error) {
      console.error(
        `[prescriptions] audit log ${eventType} insert failed`,
        error
      );
    }
  } catch (err) {
    console.error(`[prescriptions] audit log ${eventType} threw`, err);
  }
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
