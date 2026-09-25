"use server";
import { safeError } from "@/lib/utils/safe-error";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { getSkill } from "@/lib/constants/skills";

/** Fetch a single highlighted 5-star review (most recent with a comment) */
export async function getFeaturedReview(doctorId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from("reviews")
    .select(
      `comment, rating, created_at,
       patient:profiles!reviews_patient_id_fkey(first_name, last_name)`
    )
    .eq("doctor_id", doctorId)
    .eq("is_visible", true)
    .eq("rating", 5)
    .not("comment", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!data) return null;

  const patient: any = Array.isArray(data.patient)
    ? data.patient[0]
    : data.patient;

  return {
    comment: data.comment as string,
    firstName: patient?.first_name ?? "Patient",
    lastInitial: patient?.last_name?.[0] ?? "",
  };
}

export interface DoctorEndorsement {
  slug: string;
  label: string;
  count: number;
}

/**
 * Aggregate skill-endorsement counts for a doctor.
 * Only counts endorsements on visible reviews (RLS also enforces this).
 */
export async function getDoctorEndorsementCounts(
  doctorId: string
): Promise<DoctorEndorsement[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("review_endorsements")
    .select("skill_slug")
    .eq("doctor_id", doctorId);

  if (error || !data) return [];

  const counts = new Map<string, number>();
  for (const row of data) {
    counts.set(row.skill_slug, (counts.get(row.skill_slug) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([slug, count]) => {
      const skill = getSkill(slug);
      return { slug, label: skill?.label ?? slug, count };
    })
    .sort((a, b) => b.count - a.count);
}

/**
 * Batch top endorsement labels for doctor cards (single query).
 * Returns map of doctorId → top N labels by count.
 */
export async function getTopEndorsementsBatch(
  doctorIds: string[],
  topN: number = 2
): Promise<Record<string, { label: string; count: number }[]>> {
  if (doctorIds.length === 0) return {};

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("review_endorsements")
    .select("doctor_id, skill_slug")
    .in("doctor_id", doctorIds);

  if (error || !data) return {};

  const perDoctor = new Map<string, Map<string, number>>();
  for (const row of data as { doctor_id: string; skill_slug: string }[]) {
    if (!perDoctor.has(row.doctor_id)) perDoctor.set(row.doctor_id, new Map());
    const m = perDoctor.get(row.doctor_id)!;
    m.set(row.skill_slug, (m.get(row.skill_slug) ?? 0) + 1);
  }

  const result: Record<string, { label: string; count: number }[]> = {};
  for (const [doctorId, counts] of perDoctor) {
    result[doctorId] = Array.from(counts.entries())
      .map(([slug, count]) => ({
        label: getSkill(slug)?.label ?? slug,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, topN);
  }
  return result;
}

export async function toggleFavorite(doctorId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  // Check if already favorited (composite PK: patient_id + doctor_id)
  const { data: existing } = await supabase
    .from("favorites")
    .select("patient_id")
    .eq("patient_id", user.id)
    .eq("doctor_id", doctorId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("patient_id", user.id)
      .eq("doctor_id", doctorId);
    if (error) return { error: safeError(error) };
    revalidatePath("/dashboard/favorites");
    return { favorited: false };
  } else {
    const { error } = await supabase.from("favorites").insert({
      patient_id: user.id,
      doctor_id: doctorId,
    });
    if (error) return { error: safeError(error) };
    revalidatePath("/dashboard/favorites");
    return { favorited: true };
  }
}

/** Check if the current user has favorited a specific doctor */
export async function checkIsFavorited(doctorId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data } = await supabase
    .from("favorites")
    .select("patient_id")
    .eq("patient_id", user.id)
    .eq("doctor_id", doctorId)
    .maybeSingle();

  return !!data;
}
