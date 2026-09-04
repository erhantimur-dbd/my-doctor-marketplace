import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getMedicalSpecialties, getTestingSpecialties } from "../specialties";
import {
  foundingRegisterHref,
  getSpecialtyInvite,
  getSpecialtyInviteSlugs,
  isClinicInviteToken,
  isMedicalInviteSlug,
  isTestingSpecialtySlug,
  SPECIALTY_INVITES,
} from "../specialty-invites";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("specialty invite config", () => {
  const medicalSlugs = getMedicalSpecialties().map((s) => s.slug);
  const testingSlugs = getTestingSpecialties().map((s) => s.slug);

  it("covers every medical specialty and skips testing slugs", () => {
    expect(getSpecialtyInviteSlugs()).toEqual(medicalSlugs);
    for (const slug of medicalSlugs) {
      expect(SPECIALTY_INVITES[slug], slug).toBeTruthy();
      const copy = getSpecialtyInvite(slug);
      expect(copy, slug).toBeTruthy();
      expect(copy!.usps.length).toBeGreaterThanOrEqual(3);
      expect(copy!.usps.length).toBeLessThanOrEqual(5);
      expect(copy!.headline.length).toBeGreaterThan(10);
      expect(copy!.subhead.length).toBeGreaterThan(10);
      expect(isMedicalInviteSlug(slug)).toBe(true);
      expect(isTestingSpecialtySlug(slug)).toBe(false);
    }
    for (const slug of testingSlugs) {
      expect(SPECIALTY_INVITES[slug]).toBeUndefined();
      expect(getSpecialtyInvite(slug)).toBeUndefined();
      expect(isTestingSpecialtySlug(slug)).toBe(true);
      expect(isMedicalInviteSlug(slug)).toBe(false);
    }
  });

  it("dentistry copy is practitioner-benefit framed", () => {
    const dentistry = getSpecialtyInvite("dentistry");
    expect(dentistry?.headline.toLowerCase()).toMatch(/dental/);
    expect(dentistry?.usps.some((u) => /book/i.test(u))).toBe(true);
    expect(dentistry?.usps.some((u) => /whitening|check-up/i.test(u))).toBe(
      true
    );
    expect(dentistry?.clinicVsSolo).toMatch(/Clinic/i);
  });

  it("CTA helper points at founding free register with specialty", () => {
    expect(foundingRegisterHref("dentistry")).toBe(
      "/register-doctor?tier=free&founding=1&specialty=dentistry"
    );
    expect(foundingRegisterHref("cardiology")).toContain("specialty=cardiology");
  });

  it("clinic invite tokens are 64-char hex and not specialty slugs", () => {
    expect(isClinicInviteToken("a".repeat(64))).toBe(true);
    expect(isClinicInviteToken("dentistry")).toBe(false);
    expect(isClinicInviteToken("blood-tests")).toBe(false);
    expect(isClinicInviteToken("abc")).toBe(false);
  });
});

describe("specialty invite routes and gates", () => {
  it("invite landing lives under invite/[specialty] and CTAs founding register", () => {
    const page = read(
      "src/app/[locale]/(public)/invite/[specialty]/page.tsx"
    );
    const landing = read(
      "src/app/[locale]/(public)/invite/[specialty]/specialty-invite-landing.tsx"
    );
    expect(page).toContain("generateStaticParams");
    expect(page).toContain("notFound()");
    expect(page).toContain("isTestingSpecialtySlug");
    expect(page).toContain("isClinicInviteToken");
    expect(landing).toContain("foundingRegisterHref");
    expect(landing).toContain('href="/pricing"');
  });

  it("soft-launch allowlists include /invite in middleware, vercel, and sitemap", () => {
    const middleware = read("middleware.ts");
    const vercel = read("vercel.json");
    const sitemap = read("src/app/sitemap.ts");
    expect(middleware).toContain('"/invite"');
    expect(vercel).toMatch(/invite/);
    expect(sitemap).toContain('"/invite"');
    expect(sitemap).toContain("getSpecialtyInviteSlugs");
  });
});
