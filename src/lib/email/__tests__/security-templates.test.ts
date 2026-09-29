import { describe, expect, it } from "vitest";
import {
  SECURITY_EMAIL_FROM,
  passkeyAddedEmail,
  securityLayout,
} from "@/lib/email/security-templates";

describe("passkeyAddedEmail", () => {
  it("uses Tesla-style subject and body copy", () => {
    const { subject, html } = passkeyAddedEmail({
      settingsUrl: "https://example.com/settings",
      supportUrl: "https://example.com/support",
    });

    expect(subject).toBe("You Have Added A Passkey");
    expect(html).toContain("Passkey added");
    expect(html).toContain(
      "A new passkey was added to your MyDoctors360 account"
    );
    expect(html).toContain("https://example.com/settings");
    expect(html).toContain(">settings<");
    expect(html).toContain("https://example.com/support");
    expect(html).toContain(">Support<");
    expect(html).toContain("remove the unrecognized passkey");
  });

  it("defaults settings and support links to app routes", () => {
    const { html } = passkeyAddedEmail();
    expect(html).toMatch(/\/en\/dashboard\/settings/);
    expect(html).toMatch(/\/en\/help-center/);
  });

  it("keeps a monochrome security shell without marketing gradient header", () => {
    const { html } = passkeyAddedEmail();
    expect(html).toContain("background-color:#ffffff");
    expect(html).not.toContain("linear-gradient");
    expect(html).not.toContain("SPECIALTY");
    expect(html).toContain("Privacy &amp; Legal");
    expect(html).toContain("Help Center");
    expect(html).toContain("MyDoctors360");
  });
});

describe("securityLayout", () => {
  it("escapes injected content only via callers; shell includes brand mark", () => {
    const html = securityLayout("<p>Hello</p>");
    expect(html).toContain("<p>Hello</p>");
    expect(html).toContain("viewBox=\"0 0 32 32\"");
  });
});

describe("SECURITY_EMAIL_FROM", () => {
  it("defaults to Account Security display name", () => {
    expect(SECURITY_EMAIL_FROM).toContain("Account Security");
    expect(SECURITY_EMAIL_FROM).toContain("noreply@mydoctors360.com");
  });
});
