import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { passwordResetEmail } from "@/lib/email/password-reset-email";

describe("password reset email", () => {
  it("uses the agreed header and no emoji strip", () => {
    const { subject, html } = passwordResetEmail({
      confirmUrl: "https://www.mydoctors360.com/en/callback?next=/en/reset-password",
    });
    expect(subject).toBe("Reset Your Password");
    expect(html).toContain("rgba(255,255,255,0.40)");
    expect(html).toContain("Where Patients Meet the Right Doctor");
    expect(html).toContain("#0B6BCB");
    expect(html).toContain("Reset Password");
    expect(html).not.toMatch(/🩺|❤|🧠|👁|👶|💊|🛡/);
    expect(html).toContain("https://www.mydoctors360.com/en/privacy");
  });

  it("keeps the Supabase paste copy on the same header", () => {
    const docs = readFileSync(
      join(process.cwd(), "docs/supabase-email-templates.html"),
      "utf8"
    );
    const reset = docs.slice(docs.indexOf("4. RESET PASSWORD"));
    expect(reset).toContain("rgba(255,255,255,0.40)");
    expect(reset).toContain("{{ .ConfirmationURL }}");
    expect(reset).not.toMatch(/🩺|❤|🧠|👁|👶|💊|🛡/);
  });
});
