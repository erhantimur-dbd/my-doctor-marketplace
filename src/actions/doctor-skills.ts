"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isValidSkillSlug,
  MAX_DOCTOR_SKILLS,
} from "@/lib/constants/skills";
import { log } from "@/lib/utils/logger";

/**
 * Fetch the signed-in doctor's own skills and specialty slugs in one call.
 * Specialties are used to decide which skills are selectable — the profile
 * editor filters the skill picker to those matching the doctor's specialties.
 */
export async function getDoctorSkillsAndSpecialties(): Promise<{
  skills: string[];
  specialties: string[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { skills: [], specialties: [] };

  const { data: doc } = await supabase
    .from("doctors")
    .select(
      "id, specialties:doctor_specialties(specialty:specialties(slug))"
    )
    .eq("profile_id", user.id)
    .single();
  if (!doc) return { skills: [], specialties: [] };

  const doctorId = (doc as { id: string }).id;

  const { data: skillRows } = await supabase
    .from("doctor_skills")
    .select("skill_slug")
    .eq("doctor_id", doctorId);

  const skills = (skillRows || [])
    .map((r: { skill_slug: string }) => r.skill_slug)
    .filter(isValidSkillSlug);

  const specRaw =
    (doc as { specialties?: { specialty?: { slug?: string } | { slug?: string }[] }[] })
      .specialties || [];
  const specialties: string[] = [];
  for (const row of specRaw) {
    const spec = Array.isArray(row.specialty) ? row.specialty[0] : row.specialty;
    if (spec?.slug) specialties.push(spec.slug);
  }

  return { skills, specialties };
}

/**
 * Replace the signed-in doctor's skills with the given list. Validates each
 * slug against the curated taxonomy; unknown slugs are dropped silently.
 * Caps at MAX_DOCTOR_SKILLS.
 *
 * Implementation: delete-then-insert for idempotent write. Uses the admin
 * client for the delete+insert pair so a mid-operation policy check can't
 * split the change.
 */
export async function setDoctorSkills(
  skillSlugs: string[]
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: doc } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();
  if (!doc) return { error: "Doctor profile not found" };

  const doctorId = (doc as { id: string }).id;
  const validSlugs = Array.from(
    new Set(
      skillSlugs.filter(
        (s): s is string => typeof s === "string" && isValidSkillSlug(s)
      )
    )
  ).slice(0, MAX_DOCTOR_SKILLS);

  const admin = createAdminClient();
  const { error: delErr } = await admin
    .from("doctor_skills")
    .delete()
    .eq("doctor_id", doctorId);
  if (delErr) {
    log.error("Delete doctor skills failed:", { err: delErr });
    return { error: "Failed to update skills" };
  }

  if (validSlugs.length > 0) {
    const rows = validSlugs.map((slug) => ({
      doctor_id: doctorId,
      skill_slug: slug,
    }));
    const { error: insErr } = await admin.from("doctor_skills").insert(rows);
    if (insErr) {
      log.error("Insert doctor skills failed:", { err: insErr });
      return { error: "Failed to update skills" };
    }
  }

  return { success: true };
}
