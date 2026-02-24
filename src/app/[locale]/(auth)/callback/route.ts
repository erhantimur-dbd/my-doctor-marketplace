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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // For OAuth users (Google/Apple), ensure profile has name populated.
        // The DB trigger creates the profile but OAuth providers store names
        // differently (full_name, name) than our first_name/last_name fields.
        const meta = user.user_metadata || {};
        const isOAuth = user.app_metadata?.provider !== "email";

        if (isOAuth) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("first_name, last_name, avatar_url")
            .eq("id", user.id)
            .single();

          if (profile && !profile.first_name) {
            // Extract names from OAuth metadata
            let firstName = meta.first_name || "";
            let lastName = meta.last_name || "";

            if (!firstName && meta.full_name) {
              const parts = (meta.full_name as string).split(" ");
              firstName = parts[0] || "";
              lastName = parts.slice(1).join(" ") || "";
            }
            if (!firstName && meta.name) {
              const parts = (meta.name as string).split(" ");
              firstName = parts[0] || "";
              lastName = parts.slice(1).join(" ") || "";
            }

            const avatarUrl =
              meta.avatar_url || meta.picture || profile.avatar_url || null;

            await supabase
              .from("profiles")
              .update({
                first_name: firstName,
                last_name: lastName,
                ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
              })
              .eq("id", user.id);
          }
        }

        if (next === "/en") {
          // For email confirmations (no custom 'next'), show the verified page.
          // For OAuth, redirect to dashboard directly.
          if (isOAuth) {
            return NextResponse.redirect(`${origin}/en`);
          }
          return NextResponse.redirect(`${origin}/en/email-verified`);
        }
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
