"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

/** Derive the app origin from incoming request headers (works on localhost,
 *  Vercel preview deploys, and production). Falls back to env var. */
async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

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
  const origin = await getOrigin();

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
      emailRedirectTo: `${origin}/en/callback`,
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
  const origin = await getOrigin();

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
      emailRedirectTo: `${origin}/en/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    // Use admin client because user has no active session yet
    // (email confirmation pending), so RLS policies would block.
    const adminSupabase = createAdminClient();

    // Wait for auth.users + profiles trigger to commit.
    // Supabase's GoTrue may return before the DB transaction is visible
    // to PostgREST, so we poll until the profile row appears.
    let profileReady = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const { data: profile } = await adminSupabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profile) {
        profileReady = true;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // If trigger still hasn't fired after 5s, create profile manually
    if (!profileReady) {
      const { error: profileError } = await adminSupabase
        .from("profiles")
        .insert({
          id: data.user.id,
          role: "doctor",
          first_name: firstName,
          last_name: lastName,
          email,
        });

      if (profileError) {
        console.error("Profile creation failed:", profileError);
        return {
          error:
            "Account created but profile setup is still processing. Please wait a moment and log in.",
        };
      }
    }

    const slug =
      `dr-${firstName}-${lastName}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") +
      "-" +
      Math.random().toString(36).substring(2, 6);

    const { error: doctorError } = await adminSupabase
      .from("doctors")
      .insert({
        profile_id: data.user.id,
        slug,
        consultation_fee_cents: 0,
      });

    if (doctorError) {
      console.error("Doctor creation failed:", doctorError);
      return { error: doctorError.message };
    }
  }

  revalidatePath("/", "layout");
  redirect("/en/verify-email");
}

export async function forgotPassword(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get("email") as string;

  const origin = await getOrigin();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/en/reset-password`,
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
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/${locale}/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }
}

export async function signInWithApple(locale: string = "en") {
  const supabase = await createClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: {
      redirectTo: `${origin}/${locale}/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (data.url) {
    redirect(data.url);
  }
}
