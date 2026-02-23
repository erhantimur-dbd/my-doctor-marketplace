import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/en";

  const supabase = await createClient();

  // Handle PKCE flow (OAuth + email confirmation with code)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Check if this is a signup email confirmation (user just verified)
      // by looking at whether 'next' is the default — email confirmations
      // don't set a custom 'next' param.
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && next === "/en") {
        // Redirect to the email-verified page
        return NextResponse.redirect(`${origin}/en/email-verified`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Handle email verification with token_hash (non-PKCE / magic link flow)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "signup" | "email" | "recovery" | "invite",
    });
    if (!error) {
      if (type === "signup" || type === "email") {
        return NextResponse.redirect(`${origin}/en/email-verified`);
      }
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/en/reset-password`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/en/login?error=auth_callback_error`);
}
