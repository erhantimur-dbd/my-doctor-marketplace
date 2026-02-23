"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function login(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const redirectTo = formData.get("redirect") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(redirectTo || "/en");
}

export async function register(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const firstName = formData.get("first_name") as string;
  const lastName = formData.get("last_name") as string;

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        role: "patient",
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/en/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/en/verify-email");
}

export async function registerDoctor(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const firstName = formData.get("first_name") as string;
  const lastName = formData.get("last_name") as string;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        role: "doctor",
      },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/en/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    // Use admin client because user has no active session yet
    // (email confirmation pending), so RLS policies would block.
    const adminSupabase = createAdminClient();

    // Ensure profile exists — the handle_new_user() trigger may not
    // have committed yet due to Supabase's async auth architecture.
    // Use upsert so it's safe if the trigger already created it.
    await adminSupabase.from("profiles").upsert(
      {
        id: data.user.id,
        role: "doctor",
        first_name: firstName,
        last_name: lastName,
        email,
      },
      { onConflict: "id", ignoreDuplicates: true }
    );

    const slug =
      `dr-${firstName}-${lastName}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") +
      "-" +
      Math.random().toString(36).substring(2, 6);

    const { error: doctorError } = await adminSupabase.from("doctors").insert({
      profile_id: data.user.id,
      slug,
      consultation_fee_cents: 0,
    });

    if (doctorError) {
      return { error: doctorError.message };
    }
  }

  revalidatePath("/", "layout");
  redirect("/en/verify-email");
}

export async function forgotPassword(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/en/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient();

  const password = formData.get("password") as string;

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/en/login");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/en");
}

export async function signInWithGoogle(locale: string = "en") {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }
}
