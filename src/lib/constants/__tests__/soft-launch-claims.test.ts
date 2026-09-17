/**
 * Soft Launch Legal/Marketing claims scrub (2026-09-07).
 * Locks Quinn/Legal replacement copy on public Soft Launch surfaces.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

const SOFT_LAUNCH_SURFACES = [
  "public/coming-soon/index.html",
  "src/lib/constants/package-features.ts",
  "src/lib/marketing/package-recommender.ts",
  "src/app/layout.tsx",
  "src/lib/seo/json-ld.ts",
  "src/app/[locale]/(public)/pricing/page.tsx",
  "src/app/[locale]/(public)/how-it-works/page.tsx",
  "src/app/[locale]/(public)/contact/page.tsx",
  "src/app/[locale]/(auth)/register/page.tsx",
  "src/app/[locale]/(auth)/login/page.tsx",
  "src/app/[locale]/(public)/register-doctor/page.tsx",
  "src/app/[locale]/(public)/register-doctor/layout.tsx",
  "src/components/layout/header.tsx",
  "src/components/layout/footer.tsx",
  "src/components/marketing/pricing-billing-toggle.tsx",
];

const SOFT_LAUNCH_TITLE_SURFACES = [
  "src/app/layout.tsx",
  "src/lib/seo/json-ld.ts",
  "src/app/[locale]/(public)/pricing/page.tsx",
  "src/app/[locale]/(public)/how-it-works/page.tsx",
  "src/app/[locale]/(auth)/login/page.tsx",
  "src/app/[locale]/(public)/register-doctor/layout.tsx",
  "public/coming-soon/index.html",
];

describe("Soft Launch public claims", () => {
  it("does not claim care plans, prescriptions, treatment plans, or fake scale", () => {
    for (const rel of SOFT_LAUNCH_SURFACES) {
      const text = read(rel);
      expect(text, rel).not.toMatch(/Care plans & prescriptions/);
      expect(text, rel).not.toMatch(/Patient CRM & care plans/);
      expect(text, rel).not.toMatch(/Analytics, waitlist & care plans/);
      expect(text, rel).not.toMatch(/Patient records, care plans and history/);
      expect(text, rel).not.toMatch(/Join hundreds of doctors/);
      expect(text, rel).not.toMatch(/Only 100 spots — filling up fast/);
      expect(text, rel).not.toMatch(/filling up fast/i);
      expect(text, rel).not.toMatch(
        /Reminders, follow-ups, invoices and treatment plans/
      );
      expect(text, rel).not.toMatch(/Ready to Book Your First Appointment/);
      expect(text, rel).not.toMatch(/Only 100 of 100 founding spots left/);
      expect(text, rel).not.toMatch(/founding spots left/i);
      expect(text, rel).not.toMatch(/thousands of patients/i);
      expect(text, rel).not.toMatch(/treatment tags/i);
      expect(text, rel).not.toMatch(/Chat or speak to find a doctor/i);
      expect(text, rel).not.toMatch(/Book Instantly/);
      expect(text, rel).not.toMatch(/free forever/i);
    }
  });

  it("Founding Free copy is £0 — no card required (not Free forever)", () => {
    const features = read("src/lib/constants/package-features.ts");
    const pricingToggle = read(
      "src/components/marketing/pricing-billing-toggle.tsx"
    );
    const comingSoon = read("public/coming-soon/index.html");
    expect(features).toMatch(/£0 — no card required/);
    expect(pricingToggle).toMatch(/£0 — no card required/);
    expect(comingSoon).toMatch(/£0 — no card required|no card required/i);
    expect(features).not.toMatch(/free forever/i);
    expect(pricingToggle).not.toMatch(/free forever/i);
  });

  it("pricing CRM + founding CTA use Legal replacements", () => {
    const pricing = read("src/app/[locale]/(public)/pricing/page.tsx");
    expect(pricing).toMatch(/Patient records and booking history/);
    expect(pricing).toMatch(/Join the Founding Doctor Programme/);
    expect(pricing).toMatch(/register-doctor\?tier=free&founding=1/);
    expect(pricing).toMatch(/Reach patients looking for your specialty/);
    expect(pricing).not.toMatch(/treatment tags/i);
  });

  it("coming-soon founding band and why-doctors grid match Legal copy", () => {
    const html = read("public/coming-soon/index.html");
    expect(html).toMatch(/First 100 founding doctors/);
    expect(html).toMatch(/Reminders, follow-ups and invoices handled for you/);
    expect(html).toMatch(
      /patient CRM and waitlist auto-notify/
    );
    expect(html).not.toMatch(/remainingSpots|spots left|filling up/i);
    expect(html).not.toMatch(/loadFoundingSpots/);
  });

  it("how-it-works and register are doctor Founding surfaces", () => {
    const how = read("src/app/[locale]/(public)/how-it-works/page.tsx");
    expect(how).toMatch(/Founding Doctor Programme/);
    expect(how).not.toMatch(/href=["']\/doctors["']/);
    expect(how).not.toMatch(/Create Free Account/);
    expect(how).not.toMatch(/thousands of patients/i);
    expect(how).not.toMatch(/Book Instantly/);
    expect(how).not.toMatch(/Ready to Book Your First Appointment/);

    const register = read("src/app/[locale]/(auth)/register/page.tsx");
    expect(register).toMatch(/Patient registration opens at launch/);
    expect(register).toMatch(/FOUNDING_REGISTER_HREF|register-doctor\?tier=free/);
    expect(register).not.toMatch(/AuthPage/);
  });

  it("Next homepage redirects to coming-soon while Soft Launch chrome is on", () => {
    const home = read("src/app/[locale]/page.tsx");
    expect(home).toMatch(/SOFT_LAUNCH_HIDE_PATIENT_MARKETPLACE_CHROME/);
    expect(home).toMatch(/redirect\("\/coming-soon\/index.html"\)/);
  });

  it("patient marketplace layouts Soft Launch-gate to coming-soon", () => {
    const doctorsLayout = read(
      "src/app/[locale]/(public)/doctors/layout.tsx"
    );
    const specialtiesLayout = read(
      "src/app/[locale]/(public)/specialties/layout.tsx"
    );
    expect(doctorsLayout).toMatch(/soft-launch-dark-layout/);
    expect(specialtiesLayout).toMatch(/soft-launch-dark-layout/);
    const redirector = read(
      "src/lib/soft-launch/redirect-patient-marketplace.ts"
    );
    expect(redirector).toMatch(/coming-soon\/index.html/);
    expect(redirector).toMatch(/SOFT_LAUNCH_HIDE_PATIENT_MARKETPLACE_CHROME/);
  });

  it("header/footer hide patient-search CTAs while Soft Launch chrome is on", () => {
    const header = read("src/components/layout/header.tsx");
    const footer = read("src/components/layout/footer.tsx");
    expect(header).toMatch(/SOFT_LAUNCH_HIDE_PATIENT_MARKETPLACE_CHROME/);
    expect(footer).toMatch(/SOFT_LAUNCH_HIDE_PATIENT_MARKETPLACE_CHROME/);
    expect(footer).toMatch(/Founding Programme/);
    expect(header).toMatch(/for_doctors/);
    expect(header).not.toMatch(/href=["']\/register["']/);
  });

  it("Soft Launch pricing chrome does not claim SMS/WhatsApp is live", () => {
    const pricingSurfaces = [
      "src/app/[locale]/(public)/pricing/page.tsx",
      "src/components/marketing/pricing-billing-toggle.tsx",
      "src/lib/constants/package-features.ts",
      "src/lib/constants/license-tiers.ts",
      "src/lib/marketing/package-recommender.ts",
      "src/app/[locale]/(public)/contact/package-recommender.tsx",
      "src/app/[locale]/(public)/how-it-works/page.tsx",
      "public/coming-soon/index.html",
    ];
    for (const rel of pricingSurfaces) {
      const text = read(rel);
      expect(text, rel).not.toMatch(/Coming on SMS/i);
      expect(text, rel).not.toMatch(/SMS & WhatsApp on (Professional|Pro)/i);
      expect(text, rel).not.toMatch(/plus SMS & WhatsApp/i);
      expect(text, rel).not.toMatch(/SMS\/WhatsApp, analytics/i);
    }

    const toggle = read("src/components/marketing/pricing-billing-toggle.tsx");
    expect(toggle).toMatch(
      /SMS and WhatsApp reminders are coming soon — not available/
    );
    expect(toggle).toMatch(/not available\s+at Soft Launch/);
  });

  it("document title / meta / OG use Founding Doctor framing, not a care marketplace", () => {
    for (const rel of SOFT_LAUNCH_TITLE_SURFACES) {
      const text = read(rel);
      expect(text, rel).not.toMatch(/Premium Private Healthcare Marketplace/i);
      expect(text, rel).not.toMatch(/private healthcare marketplace/i);
      expect(text, rel).not.toMatch(/receive premium healthcare/i);
      expect(text, rel).not.toMatch(/book instantly/i);
    }

    const root = read("src/app/layout.tsx");
    expect(root).toMatch(/MyDoctors360 — Founding Doctor Programme/);
    expect(root).toMatch(/private practice platform for UK and European doctors/);

    const jsonLd = read("src/lib/seo/json-ld.ts");
    expect(jsonLd).toMatch(/private practice platform for founding doctors/);
    expect(jsonLd).toMatch(/Founding Doctor Programme/);

    const pricing = read("src/app/[locale]/(public)/pricing/page.tsx");
    expect(pricing).toMatch(/title: "Pricing"/);
    expect(pricing).toMatch(/Founding Doctor Programme plans/);

    const login = read("src/app/[locale]/(auth)/login/page.tsx");
    expect(login).toMatch(/title: "Sign in"/);
    expect(login).toMatch(/Founding Doctor Programme/);

    const registerLayout = read(
      "src/app/[locale]/(public)/register-doctor/layout.tsx"
    );
    expect(registerLayout).toMatch(
      /title: "Join the Founding Doctor Programme"/
    );
  });

  it("does not mount patient-finder chat on Soft Launch layout", () => {
    const layout = read("src/app/[locale]/layout.tsx");
    expect(layout).toMatch(/SOFT_LAUNCH_HIDE_PATIENT_MARKETPLACE_CHROME/);
    expect(layout).toMatch(/!SOFT_LAUNCH_HIDE_PATIENT_MARKETPLACE_CHROME/);
  });
});
