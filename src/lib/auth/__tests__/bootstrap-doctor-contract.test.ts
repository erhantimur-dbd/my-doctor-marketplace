import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) =>
  readFileSync(join(process.cwd(), rel), "utf8");

describe("OAuth doctor bootstrap contracts", () => {
  it("exports bootstrapDoctorShell and sets free license", () => {
    const boot = read("src/lib/auth/bootstrap-doctor.ts");
    expect(boot).toMatch(/export async function bootstrapDoctorShell/);
    expect(boot).toContain('tier: "free"');
    expect(boot).toContain('role: "doctor"');
  });

  it("callback invokes bootstrap when doctor OAuth cookie set", () => {
    const cb = read("src/app/[locale]/(auth)/callback/route.ts");
    expect(cb).toContain("bootstrapDoctorShell");
    expect(cb).toContain("DOCTOR_OAUTH_INTENT_COOKIE");
  });

  it("register-doctor Google OAuth passes doctorIntent", () => {
    const page = read("src/app/[locale]/(public)/register-doctor/page.tsx");
    expect(page).toContain("doctorIntent: true");
  });
});

describe("GMC country-aware validation", () => {
  it("only requires 7-digit GMC when country is GB", () => {
    const page = read("src/app/[locale]/(public)/register-doctor/page.tsx");
    expect(page).toContain('country === "GB"');
    expect(page).toContain("National regulator");
    expect(page).toMatch(/if \(country === "GB"\)[\s\S]*7-digit GMC/);
  });
});

describe("profile completion specialties", () => {
  it("uses hasSpecialties prop not doctor.specialties column", () => {
    const card = read("src/components/doctor/profile-completion-card.tsx");
    expect(card).toContain("hasSpecialties");
    expect(card).not.toMatch(/doctor\.specialties && doctor\.specialties\.length/);
    const dash = read("src/app/[locale]/(doctor)/doctor-dashboard/page.tsx");
    expect(dash).toContain("doctor_specialties");
    expect(dash).toContain("hasSpecialties=");
  });
});

describe("testing addon Stripe", () => {
  it("register checkout can add testing line item", () => {
    const auth = read("src/actions/auth.ts");
    expect(auth).toContain("getOrCreateTestingAddonPriceId");
    expect(auth).toContain("has_testing_addon");
    const tiers = read("src/lib/constants/license-tiers.ts");
    expect(tiers).toMatch(/getOrCreateTestingAddonPriceId/);
  });
});
