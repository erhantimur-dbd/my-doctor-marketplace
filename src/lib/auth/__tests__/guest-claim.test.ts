import { describe, expect, it } from "vitest";
import {
  buildGuestClaimRedirectUrl,
  shouldSendGuestClaimEmail,
} from "@/lib/auth/guest-claim";

describe("guest claim helpers", () => {
  it("builds callback URL that lands on reset-password after recovery", () => {
    expect(buildGuestClaimRedirectUrl("https://mydoctors360.com", "en")).toBe(
      "https://mydoctors360.com/en/callback?next=/en/reset-password"
    );
    expect(buildGuestClaimRedirectUrl("https://app.example/", "de")).toBe(
      "https://app.example/de/callback?next=/de/reset-password"
    );
  });

  it("only sends claim email for guest bookings with email", () => {
    expect(
      shouldSendGuestClaimEmail({
        is_guest: true,
        patient_email: "a@b.com",
      })
    ).toBe(true);
    expect(
      shouldSendGuestClaimEmail({
        is_guest: false,
        patient_email: "a@b.com",
      })
    ).toBe(false);
    expect(
      shouldSendGuestClaimEmail({
        is_guest: true,
        patient_email: null,
      })
    ).toBe(false);
  });
});
