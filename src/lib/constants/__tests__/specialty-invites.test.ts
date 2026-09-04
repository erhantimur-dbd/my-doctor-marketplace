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
      expect(copy!.usps).toHaveLength(5);
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

  it("dentistry uses the locked 5-bullet pack", () => {
    const dentistry = getSpecialtyInvite("dentistry");
    expect(dentistry?.headline.toLowerCase()).toMatch(/dental/);
    expect(dentistry?.usps[0]).toMatch(/private dental practice/i);
    expect(dentistry?.usps[1]).toMatch(/Founding Free/i);
    expect(dentistry?.usps[4]).toMatch(/not CQC/i);
    expect(dentistry?.usps.join(" ")).not.toMatch(/£|Clinic plan|patients booking now/i);
  });

  it("does not invent unknown specialties", () => {
    expect(getSpecialtyInvite("not-a-specialty")).toBeUndefined();
    expect(getSpecialtyInvite("blood-tests")).toBeUndefined();
  });

  it("non-override specialties use Parker’s 5-bullet template", () => {
    const copy = getSpecialtyInvite("neurology");
    expect(copy?.usps).toEqual([
      "Built for neurology private practice — booking, calendar, video, payments for independent neurology clinicians.",
      "Founding Free — claim a founding seat, build your profile before patient launch (no card).",
      "Verified profile path — list with credentials patients can trust when discovery opens.",
      "Specialty-ready listing — fees, consult types, and availability suited to neurology (not a generic GP-only form).",
      "You stay clinically independent — MD360 is booking/video/payments software, not CQC / not care delivery.",
    ]);
  });

  it("hard-rules: no Clinic £, live booking, care/Rx, or invented diagnoses", () => {
    const forbidden =
      /£\d|clinic plan|patients booking now|prescription|care plan|symptom ai|diagnose |we provide care|we treat/i;
    for (const slug of medicalSlugs) {
      const blob = getSpecialtyInvite(slug)!.usps.join(" ");
      expect(blob, slug).not.toMatch(forbidden);
    }
    const landing = read(
      "src/app/[locale]/(public)/invite/[specialty]/specialty-invite-landing.tsx"
    );
    expect(landing).not.toMatch(forbidden);
    expect(landing).toContain("foundingRegisterHref");
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
