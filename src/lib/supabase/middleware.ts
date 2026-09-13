import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

type SessionResult = {
  supabase: ReturnType<typeof createServerClient> | null;
  user: User | null;
  response: NextResponse;
};

/**
 * Refresh the Supabase auth cookie. Must never throw: Preview Edge
 * MIDDLEWARE_INVOCATION_FAILED is a 500 on every path after SSO if
 * NEXT_PUBLIC_SUPABASE_* is missing/invalid or getUser rejects.
 *
 * Always return the same `response` (next-intl headers). Do not invent a
 * NextResponse.next() here — that skips locale headers and makes getLocale()
 * throw on /pricing (specialty #19).
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse
): Promise<SessionResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error(
      "[supabase-middleware] missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
    return { supabase: null, user: null, response };
  }

  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return { supabase, user, response };
  } catch (error) {
    console.error("[supabase-middleware] updateSession failed:", error);
    return { supabase: null, user: null, response };
  }
}
