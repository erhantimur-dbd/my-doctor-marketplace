import { afterEach, describe, expect, it } from "vitest";
import { patientFacingEmailOrigin } from "@/lib/http/email-origin";
import { manageBookingUrl } from "@/lib/email/softsmoke-templates";

describe("patientFacingEmailOrigin", () => {
  const previous = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous;
  });

  it("sends confirmation and refund links to www, not a Vercel alias", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://mydoctor-marketplace.vercel.app";
    expect(patientFacingEmailOrigin()).toBe("https://www.mydoctors360.com");
    expect(manageBookingUrl("booking-1")).toBe(
      "https://www.mydoctors360.com/en/dashboard/bookings/booking-1"
    );
  });

  it("keeps localhost and the other production TLDs", () => {
    expect(patientFacingEmailOrigin("http://localhost:3000")).toBe(
      "http://localhost:3000"
    );
    expect(patientFacingEmailOrigin("https://mydoctors360.co.uk")).toBe(
      "https://www.mydoctors360.co.uk"
    );
  });
});
