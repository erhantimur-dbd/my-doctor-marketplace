"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sendEmail } from "@/lib/email/client";
import { welcomeEmail } from "@/lib/email/templates";
import { TERMS_VERSION } from "@/lib/auth/oauth-providers";
import { log } from "@/lib/utils/logger";
import { safeError } from "@/lib/utils/safe-error";

function safeNext(raw: string | null | undefined, locale: string): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return `/${locale}/dashboard`;
}

export async function acceptTerms(formData: FormData) {
  const locale = (formData.get("locale") as string) || "en";
  const next = safeNext(formData.get("next") as string | null, locale);
  const accepted = formData.get("accepted") === "on" || formData.get("accepted") === "true";

  if (!accepted) {
    return { error: "You must accept the Terms of Service and Privacy Policy to continue." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const now = new Date().toISOString();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("first_name, terms_accepted_at")
    .eq("id", user.id)
    .single();

  if (profileError) {
    return { error: safeError(profileError) };
  }

  // Already accepted (e.g. double-submit) — just continue
  if (profile?.terms_accepted_at) {
    revalidatePath("/", "layout");
    redirect(next);
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      terms_accepted_at: now,
      privacy_accepted_at: now,
      terms_version: TERMS_VERSION,
    })
    .eq("id", user.id);

  if (updateError) {
    return { error: safeError(updateError) };
  }

  // Welcome email once, on first terms acceptance for OAuth users
  const email = user.email;
  if (email) {
    const name = profile?.first_name || user.user_metadata?.first_name || "there";
    const { subject, html } = welcomeEmail({ name });
    sendEmail({ to: email, subject, html }).catch((err) =>
      log.error("[Auth] OAuth welcome email error:", { err })
    );
  }

  revalidatePath("/", "layout");
  redirect(next);
}
