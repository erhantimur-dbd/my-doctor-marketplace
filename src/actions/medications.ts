"use server";

import { createClient } from "@/lib/supabase/server";

interface Medication {
  id: number;
  name: string;
  generic_name: string | null;
  category: string;
  form: string | null;
}

export async function searchMedications(query: string): Promise<Medication[]> {
  if (!query || query.length < 2) {
    return [];
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("search_medications", {
      search_query: query,
    });

    if (error) {
      console.error("Failed to search medications:", error.message);
      return [];
    }

    return (data as Medication[]) ?? [];
  } catch (error) {
    console.error("Unexpected error searching medications:", error);
    return [];
  }
}
