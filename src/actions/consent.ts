"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookieConsentSchema } from "@/lib/validators/consent";

export async function saveCookieConsent(input: {
  analytics: boolean;
  marketing: boolean;
  anonymousId?: string;
}) {
  const parsed = cookieConsentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid consent data." };
  }

  const { analytics, marketing } = parsed.data;

  // Check if user is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const admin = createAdminClient();

  if (user) {
    // Authenticated: upsert by user_id
    const { error } = await admin
      .from("cookie_consents")
      .upsert(
        {
          user_id: user.id,
          anonymous_id: null,
          analytics,
          marketing,
          consent_given_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (error) {
      console.error("[Consent] DB upsert error:", error);
      return { error: "Failed to save consent." };
    }
  } else if (input.anonymousId) {
    // Anonymous: insert with anonymous_id
    const { error } = await admin.from("cookie_consents").insert({
      user_id: null,
      anonymous_id: input.anonymousId,
      analytics,
      marketing,
      consent_given_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      // Likely duplicate — not critical for anonymous users
      console.error("[Consent] Anonymous insert error:", error);
    }
  }

  return { success: true };
}
