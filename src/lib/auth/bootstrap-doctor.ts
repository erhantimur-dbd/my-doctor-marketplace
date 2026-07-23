/**
 * Create a minimal doctor + org + free license shell for OAuth doctor signup.
 * Does not replace the full wizard — profile completion still required.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/utils/logger";

export type BootstrapDoctorResult =
  | { ok: true; doctorId: string; orgId: string | null; created: boolean }
  | { ok: false; error: string };

/**
 * Ensure the user has profile role=doctor, a doctors row, org, and free license.
 * Idempotent if doctor already exists.
 */
export async function bootstrapDoctorShell(params: {
  userId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<BootstrapDoctorResult> {
  const admin = createAdminClient();
  const firstName = (params.firstName || "Doctor").trim() || "Doctor";
  const lastName = (params.lastName || "User").trim() || "User";
  const email = params.email.trim().toLowerCase();

  try {
    // Role
    await admin
      .from("profiles")
      .upsert(
        {
          id: params.userId,
          role: "doctor",
          first_name: firstName,
          last_name: lastName,
          email,
        },
        { onConflict: "id" }
      );

    const { data: existing } = await admin
      .from("doctors")
      .select("id, organization_id")
      .eq("profile_id", params.userId)
      .maybeSingle();

    if (existing) {
      return {
        ok: true,
        doctorId: existing.id,
        orgId: existing.organization_id,
        created: false,
      };
    }

    const slug =
      `dr-${firstName}-${lastName}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") +
      "-" +
      Math.random().toString(36).substring(2, 6);

    const referralCode = (
      firstName.substring(0, 2) +
      lastName.substring(0, 2) +
      Math.random().toString(36).substring(2, 6)
    ).toUpperCase();

    const { data: newDoctor, error: doctorError } = await admin
      .from("doctors")
      .insert({
        profile_id: params.userId,
        slug,
        title: "Dr.",
        consultation_fee_cents: 0,
        referral_code: referralCode,
        consultation_types: ["in_person"],
        languages: ["en"],
        base_currency: "GBP",
      })
      .select("id")
      .single();

    if (doctorError || !newDoctor) {
      log.error("OAuth doctor bootstrap insert failed", { err: doctorError });
      return { ok: false, error: doctorError?.message || "doctor_create_failed" };
    }

    let orgId: string | null = null;
    try {
      const orgSlug =
        `dr-${firstName}-${lastName}-practice`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") +
        "-" +
        Math.random().toString(36).substring(2, 6);

      const { data: newOrg } = await admin
        .from("organizations")
        .insert({
          name: `Dr. ${firstName} ${lastName}'s Practice`,
          slug: orgSlug,
          email,
        })
        .select("id")
        .single();

      if (newOrg) {
        orgId = newOrg.id;
        await admin.from("organization_members").insert({
          organization_id: newOrg.id,
          user_id: params.userId,
          role: "owner",
          status: "active",
          accepted_at: new Date().toISOString(),
        });
        await admin
          .from("doctors")
          .update({ organization_id: newOrg.id })
          .eq("id", newDoctor.id);

        await admin.from("licenses").insert({
          organization_id: newOrg.id,
          tier: "free",
          status: "active",
          max_seats: 1,
          used_seats: 1,
          current_period_start: new Date().toISOString(),
          current_period_end: "2099-12-31T23:59:59.000Z",
        });
      }
    } catch (orgErr) {
      log.error("OAuth doctor org bootstrap failed", { err: orgErr });
    }

    return {
      ok: true,
      doctorId: newDoctor.id,
      orgId,
      created: true,
    };
  } catch (err) {
    log.error("OAuth doctor bootstrap error", { err });
    return { ok: false, error: "bootstrap_failed" };
  }
}
