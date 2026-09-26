/**
 * Rotated Supabase cookies are written onto the next-intl response.
 * Protected redirects must copy them or the browser keeps the old token.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { copyResponseCookies } from "@/lib/supabase/middleware";

describe("middleware redirect cookies", () => {
  it("copies rotated auth cookie attributes onto a redirect", () => {
    const session = NextResponse.next();
    session.cookies.set("sb-access-token", "rotated-access", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    });
    session.cookies.set("sb-refresh-token", "rotated-refresh", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    const redirect = copyResponseCookies(
      session,
      NextResponse.redirect("https://example.com/en/login")
    );

    expect(redirect.status).toBe(307);
    expect(redirect.headers.get("location")).toBe(
      "https://example.com/en/login"
    );

    const access = redirect.cookies.get("sb-access-token");
    const refresh = redirect.cookies.get("sb-refresh-token");
    expect(access?.value).toBe("rotated-access");
    expect(access?.httpOnly).toBe(true);
    expect(access?.secure).toBe(true);
    expect(access?.sameSite).toBe("lax");
    expect(access?.path).toBe("/");
    expect(access?.maxAge).toBe(3600);
    expect(refresh?.value).toBe("rotated-refresh");
    expect(refresh?.httpOnly).toBe(true);
    expect(refresh?.secure).toBe(true);
    expect(refresh?.maxAge).toBe(60 * 60 * 24 * 30);

    const setCookie = redirect.headers.getSetCookie();
    expect(
      setCookie.some(
        (header) =>
          header.includes("sb-access-token=rotated-access") &&
          header.includes("HttpOnly") &&
          header.includes("Secure") &&
          header.includes("SameSite=lax") &&
          header.includes("Path=/") &&
          header.includes("Max-Age=3600")
      )
    ).toBe(true);
    expect(
      setCookie.some(
        (header) =>
          header.includes("sb-refresh-token=rotated-refresh") &&
          header.includes("HttpOnly")
      )
    ).toBe(true);

    // Source response still holds the rotated cookies (normal return path).
    expect(session.cookies.get("sb-access-token")?.value).toBe(
      "rotated-access"
    );
  });

  it("leaves a redirect unchanged when the session response set no cookies", () => {
    const session = NextResponse.next();
    const redirect = copyResponseCookies(
      session,
      NextResponse.redirect("https://example.com/en/login")
    );
    expect(redirect.cookies.getAll()).toEqual([]);
    expect(redirect.headers.getSetCookie()).toEqual([]);
  });

  it("every redirect after session refresh copies intlResponse cookies", () => {
    const middleware = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");
    const after = middleware.split("await updateSession")[1] ?? "";
    expect(after).toMatch(/copyResponseCookies/);
    expect(after).not.toMatch(/return NextResponse\.redirect\(/);
    expect(middleware).toMatch(/return intlResponse/);
    // Sitemap/robots early return is the only NextResponse.next().
    const nextCalls = middleware.match(/return NextResponse\.next\(\)/g) ?? [];
    expect(nextCalls).toHaveLength(1);
  });
});
