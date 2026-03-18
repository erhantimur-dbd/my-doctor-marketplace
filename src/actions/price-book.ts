"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { log } from "@/lib/utils/logger";

async function requireDoctor() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", supabase: null, doctor: null };

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, base_currency")
    .eq("profile_id", user.id)
    .single();

  if (!doctor) return { error: "Not a doctor", supabase: null, doctor: null };
  return { error: null, supabase, doctor };
}

export interface PriceBookEntry {
  id: string;
  test_id: string;
  price_cents: number;
  custom_name: string | null;
}

export async function getPriceBook(): Promise<{
  entries: PriceBookEntry[];
  error?: string;
}> {
  try {
    const { error: authError, supabase, doctor } = await requireDoctor();
    if (authError || !supabase || !doctor) {
      return { entries: [], error: authError || "Authentication failed" };
    }

    const { data, error } = await supabase
      .from("doctor_price_book")
      .select("id, test_id, price_cents, custom_name")
      .eq("doctor_id", doctor.id)
      .order("test_id");

    if (error) {
      log.error("getPriceBook error:", { err: error });
      return { entries: [], error: "Failed to fetch price book." };
    }

    return { entries: (data || []) as PriceBookEntry[] };
  } catch (err) {
    log.error("getPriceBook error:", { err: err });
    return { entries: [], error: "An unexpected error occurred." };
  }
}

export async function savePriceBookEntries(
  entries: { test_id: string; price_cents: number; custom_name?: string | null }[]
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { error: authError, supabase, doctor } = await requireDoctor();
    if (authError || !supabase || !doctor) {
      return { error: authError || "Authentication failed" };
    }

    // Validate entries
    for (const entry of entries) {
      if (!entry.test_id || entry.price_cents < 0) {
        return { error: "Invalid price book entry." };
      }
    }

    // Upsert all entries
    const upsertData = entries.map((e) => ({
      doctor_id: doctor.id,
      test_id: e.test_id,
      price_cents: e.price_cents,
      custom_name: e.custom_name || null,
    }));

    const { error } = await supabase
      .from("doctor_price_book")
      .upsert(upsertData, { onConflict: "doctor_id,test_id" });

    if (error) {
      log.error("savePriceBookEntries error:", { err: error });
      return { error: "Failed to save price book." };
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    log.error("savePriceBookEntries error:", { err: err });
    return { error: "An unexpected error occurred." };
  }
}

export async function deletePriceBookEntry(
  testId: string
): Promise<{ success?: boolean; error?: string }> {
  try {
    const { error: authError, supabase, doctor } = await requireDoctor();
    if (authError || !supabase || !doctor) {
      return { error: authError || "Authentication failed" };
    }

    const { error } = await supabase
      .from("doctor_price_book")
      .delete()
      .eq("doctor_id", doctor.id)
      .eq("test_id", testId);

    if (error) {
      log.error("deletePriceBookEntry error:", { err: error });
      return { error: "Failed to delete entry." };
    }

    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    log.error("deletePriceBookEntry error:", { err: err });
    return { error: "An unexpected error occurred." };
  }
}
