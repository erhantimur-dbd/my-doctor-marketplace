import { describe, expect, it } from "vitest";
import { guestAccountClaimEmail } from "@/lib/email/templates";

describe("guestAccountClaimEmail", () => {
  it("primary CTA is one-click magic session", () => {
    const { subject, html } = guestAccountClaimEmail({
      patientName: "Alex",
      claimUrl: "https://example.com/magic",
      bookingNumber: "BK-100",
      setPasswordUrl: "https://example.com/set-pw",
      magicSession: true,
    });
    expect(subject.toLowerCase()).toMatch(/one-click|sign-in|booking/);
    expect(html).toContain("https://example.com/magic");
    expect(html).toContain("Open my bookings");
    expect(html).toContain("https://example.com/set-pw");
    expect(html).toContain("Set a password");
    expect(html).toContain("BK-100");
    expect(html).toContain("Alex");
  });

  it("prints legacy BK- and short MD- booking numbers, including -R", () => {
    for (const bookingNumber of [
      "BK-20260926-2FB5",
      "BK-20260926-2FB5-R",
      "MD-7K3Q9X",
      "MD-7K3Q9X-R",
    ]) {
      const { html } = guestAccountClaimEmail({
        patientName: "Alex",
        claimUrl: "https://example.com/magic",
        bookingNumber,
        magicSession: true,
      });
      expect(html).toContain(bookingNumber);
    }
  });

  it("recovery-only fallback still works", () => {
    const { html } = guestAccountClaimEmail({
      patientName: "Sam",
      claimUrl: "https://example.com/recovery",
      magicSession: false,
    });
    expect(html).toContain("Set my password");
    expect(html).toContain("https://example.com/recovery");
  });
});
