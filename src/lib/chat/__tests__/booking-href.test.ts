import { describe, expect, it } from "vitest";
import {
  defaultAuthTabForRedirect,
  isBookRedirect,
  parseBookRedirect,
} from "@/lib/chat/booking-href";

describe("isBookRedirect", () => {
  it("does not treat doctor-dashboard bookings as a patient book redirect", () => {
    expect(isBookRedirect("/en/doctor-dashboard/bookings")).toBe(false);
    expect(isBookRedirect("/doctor-dashboard/bookings")).toBe(false);
    expect(
      isBookRedirect("/en/doctor-dashboard/organization/bookings")
    ).toBe(false);
    expect(
      isBookRedirect("/de/doctor-dashboard/bookings?from=/en/dashboard")
    ).toBe(false);
    expect(parseBookRedirect("/en/doctor-dashboard/bookings")).toBeNull();
  });

  it("still matches a patient doctor book URL, including query", () => {
    expect(isBookRedirect("/en/doctors/dr-vera-softsmoke-i6jv/book")).toBe(
      true
    );
    expect(
      isBookRedirect(
        "/en/doctors/dr-x/book?date=2026-08-01&time=10:00&type=video"
      )
    ).toBe(true);
    expect(isBookRedirect("/en/doctors/dr-x/book/")).toBe(true);
    expect(
      parseBookRedirect(
        "/en/doctors/dr-x/book?date=2026-08-01&time=10:00&type=video&service=svc"
      )?.slug
    ).toBe("dr-x");
  });

  it("does not match a doctor profile whose slug merely starts with book", () => {
    expect(isBookRedirect("/en/doctors/book-a-consult")).toBe(false);
  });

  it("keeps legacy /booking paths and does not match the plural bookings list via that clause", () => {
    expect(isBookRedirect("/en/booking")).toBe(true);
    expect(isBookRedirect("/en/booking-confirmation")).toBe(true);
    expect(isBookRedirect("/en/admin/bookings")).toBe(false);
    expect(isBookRedirect(null)).toBe(false);
    expect(isBookRedirect("")).toBe(false);
  });
});

describe("defaultAuthTabForRedirect", () => {
  it("keeps login on Sign In for a doctor-dashboard bookings redirect", () => {
    expect(
      defaultAuthTabForRedirect("sign-in", "/en/doctor-dashboard/bookings")
    ).toBe("sign-in");
    expect(
      defaultAuthTabForRedirect(
        "sign-in",
        "/en/doctor-dashboard/organization/bookings"
      )
    ).toBe("sign-in");
  });

  it("still defaults a patient book redirect to Create Account", () => {
    expect(
      defaultAuthTabForRedirect(
        "sign-in",
        "/en/doctors/dr-vera-softsmoke-i6jv/book?slot=1"
      )
    ).toBe("sign-up");
    expect(
      defaultAuthTabForRedirect("sign-in", "/en/login", true)
    ).toBe("sign-up");
  });

  it("respects an explicit sign-up default and a plain login", () => {
    expect(defaultAuthTabForRedirect("sign-up", "/en/doctor-dashboard")).toBe(
      "sign-up"
    );
    expect(defaultAuthTabForRedirect("sign-in", "/en/doctor-dashboard")).toBe(
      "sign-in"
    );
    expect(defaultAuthTabForRedirect("sign-in", "")).toBe("sign-in");
  });
});
