import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("auth security wiring", () => {
  it("opts browser and server clients into experimental passkeys", () => {
    const browser = readFileSync(
      join(process.cwd(), "src/lib/supabase/client.ts"),
      "utf8"
    );
    const server = readFileSync(
      join(process.cwd(), "src/lib/supabase/server.ts"),
      "utf8"
    );
    expect(browser).toContain("SUPABASE_AUTH_CLIENT_OPTIONS");
    expect(server).toContain("SUPABASE_AUTH_CLIENT_OPTIONS");
  });

  it("login page exposes passkey sign-in", () => {
    const authPage = readFileSync(
      join(process.cwd(), "src/components/auth/auth-page.tsx"),
      "utf8"
    );
    expect(authPage).toContain("PasskeySignInButton");
    expect(authPage).toContain("verify-mfa");
    expect(authPage).toContain("redirect=");
  });

  it("settings surfaces both passkeys and 2FA", () => {
    const patient = readFileSync(
      join(process.cwd(), "src/app/[locale]/(patient)/dashboard/settings/settings-form.tsx"),
      "utf8"
    );
    const doctor = readFileSync(
      join(process.cwd(), "src/app/[locale]/(doctor)/doctor-dashboard/settings/page.tsx"),
      "utf8"
    );
    expect(patient).toContain("AccountSecuritySections");
    expect(doctor).toContain("AccountSecuritySections");
  });

  it("MFA verify persists AAL2 session via rate-limited server action", () => {
    const mfa = readFileSync(join(process.cwd(), "src/actions/mfa.ts"), "utf8");
    expect(mfa).toContain("rateLimit");
    expect(mfa).toContain("looksLikeJwt");
    expect(mfa).toContain("setSession");
  });

  it("Permissions-Policy allows WebAuthn credential APIs", () => {
    const nextConfig = readFileSync(
      join(process.cwd(), "next.config.ts"),
      "utf8"
    );
    expect(nextConfig).toContain("publickey-credentials-get=(self)");
    expect(nextConfig).toContain("publickey-credentials-create=(self)");
  });
});
