import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  comingSoonGateApplies,
  isAllowedOnComingSoon,
  isComingSoonBookDeepLink,
  isPatientMarketplacePath,
} from "@/lib/soft-launch/coming-soon-gate";

describe("comingSoonGateApplies", () => {
  it("applies on every host while Soft Launch chrome is on (Preview FAIL)", () => {
    expect(
      comingSoonGateApplies(
        "mydoctors360-git-cursor-soft-launc.vercel.app",
        "preview"
      )
    ).toBe(true);
    expect(comingSoonGateApplies("localhost", undefined)).toBe(true);
    expect(comingSoonGateApplies("www.mydoctors360.com", "production")).toBe(
      true
    );
    // Flag is compile-time true — do not leave Preview live if VERCEL_ENV inlines
    expect(
      comingSoonGateApplies("mydoctors360.vercel.app", "production")
    ).toBe(true);
  });
});

describe("isAllowedOnComingSoon", () => {
  it("allows founding doctor routes", () => {
    expect(isAllowedOnComingSoon("/en/pricing")).toBe(true);
    expect(isAllowedOnComingSoon("/en/how-it-works")).toBe(true);
    expect(isAllowedOnComingSoon("/en/register-doctor")).toBe(true);
    expect(isAllowedOnComingSoon("/en/login")).toBe(true);
  });

  it("allows Soft Launch Soft CTA authenticated patient dashboard surfaces", () => {
    expect(isAllowedOnComingSoon("/en/dashboard")).toBe(true);
    expect(isAllowedOnComingSoon("/en/dashboard/bookings")).toBe(true);
    expect(isAllowedOnComingSoon("/en/dashboard/bookings/abc/video-room")).toBe(
      true
    );
    expect(isAllowedOnComingSoon("/en/register")).toBe(true);
  });

  it("allows locale-aware Checkout booking-confirmation", () => {
    expect(isAllowedOnComingSoon("/en/booking-confirmation")).toBe(true);
    expect(
      isAllowedOnComingSoon(
        "/en/booking-confirmation?session_id=cs_test_softsmoke"
      )
    ).toBe(true);
    expect(
      isAllowedOnComingSoon(
        "/de/booking-confirmation?booking_id=bk_1&wallet=true"
      )
    ).toBe(true);
    expect(isAllowedOnComingSoon("/booking-confirmation/")).toBe(true);
    expect(isAllowedOnComingSoon("/en/booking-confirmation-extra")).toBe(
      false
    );
    expect(isPatientMarketplacePath("/en/booking-confirmation")).toBe(false);
  });

  it("allows Soft Launch Soft CTA book deep-link only", () => {
    expect(
      isAllowedOnComingSoon("/en/doctors/dr-vera-softsmoke-i6jv/book")
    ).toBe(true);
    expect(
      isAllowedOnComingSoon("/en/doctors/dr-vera-softsmoke-i6jv/book/")
    ).toBe(true);
    expect(
      isAllowedOnComingSoon("/en/doctors/dr-vera-softsmoke-i6jv/book?slot=1")
    ).toBe(true);
    expect(
      isComingSoonBookDeepLink("/en/doctors/dr-vera-softsmoke-i6jv/book?slot=1")
    ).toBe(true);
    expect(
      isAllowedOnComingSoon("/en/doctors/dr-vera-softsmoke-i6jv/book/extra")
    ).toBe(false);
    expect(isAllowedOnComingSoon("/en/doctors")).toBe(false);
    expect(isAllowedOnComingSoon("/en/doctors/dr-jane")).toBe(false);
    expect(isComingSoonBookDeepLink("/en/doctors")).toBe(false);
    expect(isComingSoonBookDeepLink("/en/doctors/dr-jane")).toBe(false);
  });

  it("allows booking-confirmation after Softsmoke / Stripe checkout", () => {
    expect(isAllowedOnComingSoon("/en/booking-confirmation")).toBe(true);
    expect(
      isAllowedOnComingSoon(
        "/en/booking-confirmation?booking_id=abc&confirm=1"
      )
    ).toBe(true);
  });

  it("does not allow patient marketplace / search", () => {
    expect(isAllowedOnComingSoon("/en/doctors")).toBe(false);
    expect(isAllowedOnComingSoon("/en/doctors/dr-jane")).toBe(false);
    expect(isAllowedOnComingSoon("/en/specialties")).toBe(false);
    expect(isAllowedOnComingSoon("/en/conditions")).toBe(false);
    expect(isAllowedOnComingSoon("/en/find")).toBe(false);
    expect(isAllowedOnComingSoon("/en/blog")).toBe(false);
    expect(isAllowedOnComingSoon("/en/clinics")).toBe(false);
    expect(isAllowedOnComingSoon("/en/rewards")).toBe(false);
    expect(isAllowedOnComingSoon("/en/find-pharmacy")).toBe(false);
    expect(isAllowedOnComingSoon("/en")).toBe(false);
  });

  it("keeps vercel.json coming-soon rewrite in sync for dashboard + book deep-link", () => {
    const vercel = JSON.parse(
      readFileSync(join(process.cwd(), "vercel.json"), "utf8")
    ) as { rewrites: { source: string; destination: string }[] };
    const comingSoon = vercel.rewrites.find(
      (rule) => rule.destination === "/coming-soon/index.html"
    );
    expect(comingSoon).toBeTruthy();
    const source = comingSoon!.source;
    // Prod custom hosts use this rewrite before middleware. Must include
    // dashboard as its own token, not only doctor-dashboard.
    expect(source).toMatch(/accept-terms\|dashboard\|booking-confirmation\|doctor-dashboard/);
    // Book deep-link only — a bare `|doctors|` token would open the directory.
    expect(source).toMatch(/doctors\/\[\^\/\]\+\/book/);
    expect(source).not.toMatch(/\|doctors\|/);

    // Vercel matches source against the full pathname. Anchor so a later
    // slash (the locale separator) cannot satisfy the negative lookahead.
    const rewrite = new RegExp(`^${source}$`);
    expect(rewrite.test("/en/booking-confirmation")).toBe(false);
    expect(rewrite.test("/de/booking-confirmation/")).toBe(false);
    expect(rewrite.test("/en/doctors/dr-vera-softsmoke-i6jv/book")).toBe(false);
    expect(rewrite.test("/en/dashboard/bookings")).toBe(false);
    expect(rewrite.test("/en/login")).toBe(false);
    expect(rewrite.test("/en/doctors")).toBe(true);
    expect(rewrite.test("/en/doctors/dr-jane")).toBe(true);
    expect(rewrite.test("/en")).toBe(true);
  });
});

describe("isPatientMarketplacePath", () => {
  it("flags Find-a-Doctor and related patient surfaces", () => {
    expect(isPatientMarketplacePath("/en/doctors")).toBe(true);
    expect(isPatientMarketplacePath("/en/doctors/map")).toBe(true);
    expect(isPatientMarketplacePath("/en/doctors/dr-vera-softsmoke-i6jv/book")).toBe(
      true
    );
    expect(isPatientMarketplacePath("/en/specialties/cardiology")).toBe(true);
    expect(isPatientMarketplacePath("/en/conditions")).toBe(true);
    expect(isPatientMarketplacePath("/en/pricing")).toBe(false);
  });
});

describe("Preview marketplace must rewrite to coming-soon", () => {
  it("gates /en/doctors on Preview (live directory FAIL)", () => {
    const previewHost = "preview.vercel.app";
    expect(comingSoonGateApplies(previewHost, "preview")).toBe(true);
    expect(isAllowedOnComingSoon("/en/doctors")).toBe(false);
    expect(isPatientMarketplacePath("/en/doctors")).toBe(true);
  });
});
