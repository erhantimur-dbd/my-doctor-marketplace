"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function removeFavorite(
  favoriteId: string
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to manage favorites." };
  }

  // Verify favorite belongs to user
  const { data: favorite, error: fetchError } = await supabase
    .from("favorites")
    .select("id, patient_id")
    .eq("id", favoriteId)
    .single();

  if (fetchError || !favorite) {
    return { error: "Favorite not found." };
  }

  if (favorite.patient_id !== user.id) {
    return { error: "You are not authorized to remove this favorite." };
  }

  const { error: deleteError } = await supabase
    .from("favorites")
    .delete()
    .eq("id", favoriteId);

  if (deleteError) {
    return { error: "Failed to remove favorite. Please try again." };
  }

  revalidatePath("/dashboard/favorites");

  return {};
}
