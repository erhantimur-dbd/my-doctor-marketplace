import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/en";

  // Helper: create a redirect response and copy all auth cookies onto it.
  // This is critical — using `cookies()` from next/headers sets cookies on
  // Next.js's internal response, but NextResponse.redirect() creates a NEW
  // response that doesn't include them. By writing cookies directly onto the
  // redirect response, the browser actually receives the session tokens.
  function createRedirectWithCookies(url: string) {
    const response = NextResponse.redirect(new URL(url, origin));
    // Copy auth cookies from the pending response onto the redirect
    for (const cookie of pendingCookies) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    return response;
  }

  // Collect cookies that Supabase wants to set
  const pendingCookies: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            pendingCookies.push({ name, value, options: options as Record<string, unknown> });
          });
        },
      },
    }
  );

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
          if (isOAuth) {
            return createRedirectWithCookies("/en");
          }
          return createRedirectWithCookies("/en/email-verified");
        }
      }

      return createRedirectWithCookies(next);
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
        return createRedirectWithCookies("/en/email-verified");
      }
      if (type === "recovery") {
        return createRedirectWithCookies("/en/reset-password");
      }
      return createRedirectWithCookies(next);
    }
  }

  return NextResponse.redirect(
    new URL("/en/login?error=auth_callback_error", origin)
  );
}
