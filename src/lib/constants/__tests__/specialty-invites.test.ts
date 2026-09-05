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

  it("locked packs match Parker’s exact bullets", () => {
    expect(getSpecialtyInvite("dentistry")?.usps).toEqual([
      "Built for private dental practice — online booking, calendar, video consults, and payments for independent dentists.",
      "Founding Free — claim a founding seat and build your clinic profile before patient discovery opens (no card).",
      "Verified listing path — credentials and practice details patients can trust when the marketplace lifts.",
      "Dental-ready profile — fees, consult types, and availability for exams, treatments, and follow-ups (not a GP-only form).",
      "You stay clinically independent — MD360 is booking, video and payments software, not CQC and not care delivery.",
    ]);
    expect(getSpecialtyInvite("cardiology")?.usps).toEqual([
      "Built for private cardiology — booking, calendar, video, and payments for independent cardiologists.",
      "Founding Free — claim a founding seat and prepare your profile ahead of patient launch (no card).",
      "Verified listing path — specialist credentials visible when discovery opens.",
      "Cardiology-ready profile — consult fees, follow-up types, and availability suited to specialty clinics.",
      "You stay clinically independent — marketplace tools only; MD360 does not provide or manage clinical care.",
    ]);
    expect(getSpecialtyInvite("general-practice")?.usps).toEqual([
      "Built for independent private GPs — booking, calendar, video, and payments without a clinic chain.",
      "Founding Free — first-100 founding seat, free profile build, no card required.",
      "Verified listing path — patients find a checked profile when the patient side opens.",
      "GP-ready profile — appointments, fees, and availability for private primary care consults.",
      "You stay clinically independent — MD360 is software for booking/video/payments, not a care provider and not CQC-registered.",
    ]);
    expect(getSpecialtyInvite("dermatology")?.usps).toEqual([
      "Built for private dermatology — booking, calendar, video, and payments for independent dermatologists.",
      "Founding Free — claim a founding seat and build your specialty profile before launch (no card).",
      "Verified listing path — specialist credentials ready for discovery day one.",
      "Dermatology-ready profile — consult types, fees, and availability for clinic and video follow-ups.",
      "You stay clinically independent — marketplace tools only; no CQC / no care delivery by MD360.",
    ]);
    const mentalHealthUsps = [
      "Built for private mental-health practice — booking, calendar, video sessions, and payments for independent clinicians.",
      "Founding Free — claim a founding seat and prepare your profile before patient discovery (no card).",
      "Verified listing path — credentials patients can trust when listings go live.",
      "Specialty-ready profile — session types, fees, and availability for video and in-clinic appointments.",
      "You stay clinically independent — MD360 provides booking/video/payments software only, not clinical care and not CQC.",
    ];
    expect(getSpecialtyInvite("psychiatry")?.usps).toEqual(mentalHealthUsps);
    expect(getSpecialtyInvite("psychology")?.usps).toEqual(mentalHealthUsps);
    expect(getSpecialtyInvite("psychiatry")?.headline).toMatch(/psychiatry/i);
    expect(getSpecialtyInvite("psychology")?.headline).toMatch(/psychology/i);
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
    expect(page).not.toContain("clinic-invitations");
    expect(page).not.toContain("ClinicInvitePage");
    expect(page).not.toContain("isClinicInviteToken");
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
    expect(sitemap).toContain("getMedicalSpecialties");
    expect(sitemap).not.toContain("specialty-invites");
  });

  it("edge middleware graph stays free of invite/clinic/stripe modules", () => {
    const middleware = read("middleware.ts");
    const supabaseMw = read("src/lib/supabase/middleware.ts");
    const routing = read("src/i18n/routing.ts");
    for (const src of [middleware, supabaseMw, routing]) {
      const imports = src
        .split("\n")
        .filter((line) => line.trim().startsWith("import "))
        .join("\n");
      expect(imports).not.toMatch(
        /specialty-invites|clinic-invitations|@\/lib\/stripe|resend/i
      );
    }
    const nextConfig = read("next.config.ts");
    // next.config rewrites() + Sentry tunnelRoute crashed Preview Edge.
    // Clinic hex rewrite lives in middleware.ts (string scan only).
    expect(nextConfig).not.toMatch(/async\s+rewrites\s*\(/);
    expect(nextConfig).not.toMatch(/invite\/accept\/:token/);
    expect(middleware).toContain("rewriteClinicInviteRequest");
    expect(middleware).toContain("isClinicInviteToken");
    expect(middleware).toContain("@/lib/clinic-invite-token");
    expect(supabaseMw).toMatch(/missing NEXT_PUBLIC_SUPABASE_URL/);
    expect(supabaseMw).toContain("updateSession failed");
  });
});
