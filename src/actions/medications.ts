"use server";

import { createClient } from "@/lib/supabase/server";

interface Medication {
  id: number;
  name: string;
  generic_name: string | null;
  category: string;
  form: string | null;
}

interface AutocompleteItem {
  id: number;
  name: string;
  category: string;
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

export async function searchAllergies(query: string): Promise<AutocompleteItem[]> {
  if (!query || query.length < 2) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("search_allergies", {
      search_query: query,
    });

    if (error) {
      console.error("Failed to search allergies:", error.message);
      return [];
    }

    return (data as AutocompleteItem[]) ?? [];
  } catch (error) {
    console.error("Unexpected error searching allergies:", error);
    return [];
  }
}

export async function searchChronicConditions(query: string): Promise<AutocompleteItem[]> {
  if (!query || query.length < 2) return [];

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("search_chronic_conditions", {
      search_query: query,
    });

    if (error) {
      console.error("Failed to search chronic conditions:", error.message);
      return [];
    }

    return (data as AutocompleteItem[]) ?? [];
  } catch (error) {
    console.error("Unexpected error searching chronic conditions:", error);
    return [];
  }
}
