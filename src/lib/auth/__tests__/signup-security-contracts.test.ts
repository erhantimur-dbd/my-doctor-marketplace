/**
 * Source contracts for sign-up + auth security gates that cannot run
 * without live Supabase/Stripe. Reads the shipped files so a missing
 * rate-limit, GMC, terms stamp, MFA, cron, or webhook signature check
 * fails this suite.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

function sliceBetween(src: string, startMarker: string, endMarker: string) {
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, start + 1);
  expect(start, `missing ${startMarker}`).toBeGreaterThan(-1);
  expect(end, `missing ${endMarker} after ${startMarker}`).toBeGreaterThan(start);
  return src.slice(start, end);
}

describe("patient / doctor / testing-service sign-up gates", () => {
  const auth = read("src/actions/auth.ts");

  it("patient register rate-limits, requires accepted + passwordSchema, stamps terms, blocks duplicate identities, and confirms to locale callback", () => {
    const fn = sliceBetween(
      auth,
      "export async function register(formData: FormData)",
      "async function createDoctorAccount"
    );
    expect(fn).toContain('rateLimit(`register:${ip}`');
    expect(fn).toContain("passwordSchema.safeParse(password)");
    expect(fn).toContain("sanitizeAuthLocale");
    expect(fn).toContain("isSafeRelativePath");
    expect(fn).toContain('formData.get("accepted")');
    expect(fn).toContain("terms_accepted_at");
    expect(fn).toContain("privacy_accepted_at");
    expect(fn).toContain("TERMS_VERSION");
    expect(fn).toContain("identities?.length === 0");
    expect(fn).toContain("emailRedirectTo: `${origin}/${locale}/callback`");
  });

  it("createDoctorAccount is the shared doctor path with the same auth gates plus case-insensitive UK GMC", () => {
    const fn = sliceBetween(
      auth,
      "async function createDoctorAccount",
      "export async function registerDoctor"
    );
    expect(fn).toContain('rateLimit(`register:${ip}`');
    expect(fn).toContain("passwordSchema.safeParse(password)");
    expect(fn).toContain("sanitizeAuthLocale");
    expect(fn).toContain("requiresUkGmcNumber");
    expect(fn).toContain("isValidGmcNumber");
    expect(fn).toContain("7-digit GMC");
    expect(fn).toContain("identities?.length === 0");
    expect(fn).toContain("terms_accepted_at");
    expect(fn).toContain("TERMS_VERSION");
    expect(fn).toContain("emailRedirectTo: `${origin}/${locale}/callback`");
    expect(auth).toMatch(
      /export async function registerDoctor\b[\s\S]*createDoctorAccount/
    );
    expect(auth).toMatch(
      /export async function registerDoctorWithCheckout\b[\s\S]*createDoctorAccount/
    );
  });

  it("testing-service register has the same rate-limit, password, duplicate, terms, and callback gates", () => {
    const fn = sliceBetween(
      auth,
      "export async function registerTestingService",
      "export async function resendVerificationEmail"
    );
    expect(fn).toContain('rateLimit(`register:${ip}`');
    expect(fn).toContain("passwordSchema.safeParse(password)");
    expect(fn).toContain("sanitizeAuthLocale");
    expect(fn).toContain("identities?.length === 0");
    expect(fn).toContain("terms_accepted_at");
    expect(fn).toContain("TERMS_VERSION");
    expect(fn).toContain("emailRedirectTo: `${origin}/${locale}/callback`");
  });
});

describe("login / forgot / resend auth security", () => {
  const auth = read("src/actions/auth.ts");

  it("login rate-limits, blocks unverified email, requires MFA AAL2, and sanitizes redirects", () => {
    const fn = sliceBetween(
      auth,
      "export async function login(formData: FormData)",
      "export async function register(formData: FormData)"
    );
    expect(fn).toContain('rateLimit(`login:${ip}`');
    expect(fn).toContain("email_confirmed_at");
    expect(fn).toContain("getAuthenticatorAssuranceLevel");
    expect(fn).toContain("sanitizeAuthLocale");
    expect(fn).toContain("isSafeRelativePath");
  });

  it("resend-verification and forgot-password are rate-limited with sanitized locale callbacks", () => {
    const resend = sliceBetween(
      auth,
      "export async function resendVerificationEmail",
      "export async function forgotPassword"
    );
    expect(resend).toContain('rateLimit(`resend:${ip}`');
    expect(resend).toContain("sanitizeAuthLocale");
    expect(resend).toContain("emailRedirectTo: `${origin}/${locale}/callback`");

    const forgot = sliceBetween(
      auth,
      "export async function forgotPassword",
      "export async function resetPassword"
    );
    expect(forgot).toContain('rateLimit(`forgot:${ip}`');
    expect(forgot).toContain("sanitizeAuthLocale");
    expect(forgot).toContain("${origin}/${locale}/callback");
  });
});

describe("middleware, callback, stripe, admin allowlist wiring", () => {
  it("middleware gates unverified email, MFA AAL, and production admin allowlist", () => {
    const mw = read("middleware.ts");
    expect(mw).toContain("email_confirmed_at");
    expect(mw).toContain("getAuthenticatorAssuranceLevel");
    expect(mw).toContain("isAdminEmailDenied");
    expect(mw).toContain('aal?.nextLevel === "aal2"');
    expect(mw).toContain('aal?.currentLevel === "aal1"');
  });

  it("auth callback sanitizes locale and next, and uses allowlisted origin", () => {
    const cb = read("src/app/[locale]/(auth)/callback/route.ts");
    expect(cb).toContain("isSafeRelativePath");
    expect(cb).toContain("sanitizeAuthLocale");
    expect(cb).toContain("resolveAppOrigin");
  });

  it("Stripe webhook fail-closes without signature or secret and verifies constructEvent", () => {
    const webhook = read("src/app/api/webhooks/stripe/route.ts");
    const post = sliceBetween(
      webhook,
      "export async function POST",
      "switch (event.type)"
    );
    expect(post).toContain('request.headers.get("stripe-signature")');
    expect(post).toContain("constructEvent");
    expect(post).toMatch(/if\s*\(\s*!sig\s*\)/);
    expect(post).toMatch(/STRIPE_WEBHOOK_SECRET/);
    expect(post).toMatch(/if\s*\(\s*!webhookSecret\s*\)/);
    expect(post).not.toMatch(/STRIPE_WEBHOOK_SECRET!/);
  });

  it("every admin requireAdmin path uses the shared fail-closed helper", () => {
    for (const rel of [
      "src/actions/admin.ts",
      "src/actions/waitlist.ts",
      "src/actions/support.ts",
      "src/lib/admin/require-admin-page.ts",
    ]) {
      const src = read(rel);
      expect(src, rel).toContain("isAdminEmailDenied");
    }
  });
});
