"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function completeMfaLogin(
  accessToken: string,
  refreshToken: string,
  locale: string,
  userRole?: string
) {
  const cookieStore = await cookies();

  // Use the Supabase server client to set the session properly,
  // but with a timeout to prevent hanging
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();

    // Race setSession against a 5-second timeout
    const result = await Promise.race([
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      }),
      new Promise<{ error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ error: { message: "timeout" } }), 5000)
      ),
    ]);

    // If setSession timed out or failed, fall back to manual cookie setting
    if (result && "error" in result && result.error) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
      const cookieName = `sb-${projectRef}-auth-token`;

      // Clear any existing chunked cookies
      const allCookies = cookieStore.getAll();
      for (const c of allCookies) {
        if (c.name.startsWith(cookieName)) {
          cookieStore.delete(c.name);
        }
      }

      // Set raw JSON session cookie (matches @supabase/ssr format)
      const sessionValue = JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      });

      cookieStore.set(cookieName, sessionValue, {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
  } catch {
    // If everything fails, still try to redirect
    // The middleware will catch unauthenticated state
  }

  // Redirect — cookies are committed before navigation
  if (userRole === "doctor") {
    redirect(`/${locale}/doctor-dashboard`);
  } else if (userRole === "admin") {
    redirect(`/${locale}/admin`);
  } else {
    redirect(`/${locale}/dashboard`);
  }
}
