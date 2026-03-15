"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function removeFavorite(
  doctorId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to manage favorites." };
  }

  // Delete using composite key (patient_id + doctor_id)
  // RLS policy ensures patient_id = auth.uid(), so no extra auth check needed
  const { error: deleteError } = await supabase
    .from("favorites")
    .delete()
    .eq("patient_id", user.id)
    .eq("doctor_id", doctorId);

  if (deleteError) {
    return { error: "Failed to remove favorite. Please try again." };
  }

  revalidatePath("/dashboard/favorites");

  return {};
}
