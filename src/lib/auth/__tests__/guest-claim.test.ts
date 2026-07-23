import { describe, expect, it } from "vitest";
import {
  buildGuestClaimRedirectUrl,
  buildGuestMagicRedirectUrl,
  buildGuestPasswordRedirectUrl,
  isMagicSessionPrimaryClaim,
  selectGuestClaimLinkType,
  shouldSendGuestClaimEmail,
} from "@/lib/auth/guest-claim";

describe("guest claim helpers (magic session)", () => {
  it("selects magiclink as primary claim type", () => {
    expect(selectGuestClaimLinkType("magiclink")).toBe("magiclink");
    expect(selectGuestClaimLinkType()).toBe("magiclink");
    expect(isMagicSessionPrimaryClaim()).toBe(true);
    expect(selectGuestClaimLinkType("recovery")).toBe("recovery");
  });

  it("builds magic redirect to callback → patient bookings", () => {
    expect(buildGuestMagicRedirectUrl("https://mydoctors360.com", "en")).toBe(
      "https://mydoctors360.com/en/callback?next=/en/dashboard/bookings"
    );
    expect(buildGuestClaimRedirectUrl("https://app.example/", "de")).toBe(
      "https://app.example/de/callback?next=/de/dashboard/bookings"
    );
  });

  it("builds optional recovery redirect to reset-password", () => {
    expect(buildGuestPasswordRedirectUrl("https://mydoctors360.com", "en")).toBe(
      "https://mydoctors360.com/en/callback?next=/en/reset-password"
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
