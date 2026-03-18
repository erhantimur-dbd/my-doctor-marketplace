"use server";
import { safeError } from "@/lib/utils/safe-error";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod/v4";

const dependentSchema = z.object({
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  date_of_birth: z.string().nullish(),
  relationship: z.enum(["child", "spouse", "parent", "sibling", "other"]),
  notes: z.string().max(500).nullish(),
});

export type DependentInput = z.infer<typeof dependentSchema>;

/**
 * Get all dependents for the current user.
 */
export async function getDependents() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("dependents")
    .select("*")
    .eq("parent_id", user.id)
    .order("created_at");

  return data || [];
}

/**
 * Add a dependent (family member).
 */
export async function addDependent(input: DependentInput) {
  const parsed = dependentSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("dependents")
    .insert({
      parent_id: user.id,
      ...parsed.data,
    });

  if (error) return { error: safeError(error) };
  return { success: true };
}

/**
 * Update a dependent.
 */
export async function updateDependent(
  dependentId: string,
  input: Partial<DependentInput>
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("dependents")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dependentId)
    .eq("parent_id", user.id);

  if (error) return { error: safeError(error) };
  return { success: true };
}

/**
 * Remove a dependent.
 */
export async function removeDependent(dependentId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("dependents")
    .delete()
    .eq("id", dependentId)
    .eq("parent_id", user.id);

  if (error) return { error: safeError(error) };
  return { success: true };
}
