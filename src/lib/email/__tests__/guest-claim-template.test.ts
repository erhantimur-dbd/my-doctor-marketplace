import { describe, expect, it } from "vitest";
import { guestAccountClaimEmail } from "@/lib/email/templates";

describe("guestAccountClaimEmail", () => {
  it("includes claim CTA and booking ref", () => {
    const { subject, html } = guestAccountClaimEmail({
      patientName: "Alex",
      claimUrl: "https://example.com/claim",
      bookingNumber: "BK-100",
    });
    expect(subject.toLowerCase()).toMatch(/password|account/);
    expect(html).toContain("https://example.com/claim");
    expect(html).toContain("BK-100");
    expect(html).toContain("Alex");
    expect(html).toContain("Set my password");
  });
});
