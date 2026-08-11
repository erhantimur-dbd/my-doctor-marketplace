import { describe, expect, it } from "vitest";
import { isValidGmcNumber } from "@/lib/founding/members";
import { FOUNDING_PROGRAMME_MAX_SPOTS, getCompanyIdentity } from "@/lib/constants/company";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("isValidGmcNumber", () => {
  it("accepts exactly 7 digits", () => {
    expect(isValidGmcNumber("1234567")).toBe(true);
    expect(isValidGmcNumber(" 7654321 ")).toBe(true);
  });

  it("rejects empty, short, long, and non-numeric", () => {
    expect(isValidGmcNumber("")).toBe(false);
    expect(isValidGmcNumber(null)).toBe(false);
    expect(isValidGmcNumber("123456")).toBe(false);
    expect(isValidGmcNumber("12345678")).toBe(false);
    expect(isValidGmcNumber("123456A")).toBe(false);
  });
});

describe("founding programme constants", () => {
  it("caps at 100 spots", () => {
    expect(FOUNDING_PROGRAMME_MAX_SPOTS).toBe(100);
  });
});

describe("company identity (no TBD_ leak when env unset)", () => {
  it("never returns TBD_ prefixes", () => {
    const prev = {
      LEGAL_ENTITY_NAME: process.env.LEGAL_ENTITY_NAME,
      COMPANIES_HOUSE_NUMBER: process.env.COMPANIES_HOUSE_NUMBER,
      REGISTERED_OFFICE: process.env.REGISTERED_OFFICE,
    };
    delete process.env.LEGAL_ENTITY_NAME;
    delete process.env.COMPANIES_HOUSE_NUMBER;
    delete process.env.REGISTERED_OFFICE;

    const c = getCompanyIdentity();
    expect(c.legalEntityName).not.toMatch(/^TBD_/);
    expect(c.companiesHouseNumber).not.toMatch(/^TBD_/);
    expect(c.registeredOffice).not.toMatch(/^TBD_/);
    expect(c.incomplete).toBe(true);
    expect(c.missingKeys).toContain("LEGAL_ENTITY_NAME");

    if (prev.LEGAL_ENTITY_NAME !== undefined)
      process.env.LEGAL_ENTITY_NAME = prev.LEGAL_ENTITY_NAME;
    if (prev.COMPANIES_HOUSE_NUMBER !== undefined)
      process.env.COMPANIES_HOUSE_NUMBER = prev.COMPANIES_HOUSE_NUMBER;
    if (prev.REGISTERED_OFFICE !== undefined)
      process.env.REGISTERED_OFFICE = prev.REGISTERED_OFFICE;
  });

  it("uses env values when set", () => {
    process.env.LEGAL_ENTITY_NAME = "MyDoctors360 Ltd";
    process.env.COMPANIES_HOUSE_NUMBER = "12345678";
    process.env.REGISTERED_OFFICE = "1 Test Street, London";
    const c = getCompanyIdentity();
    expect(c.legalEntityName).toBe("MyDoctors360 Ltd");
    expect(c.companiesHouseNumber).toBe("12345678");
    expect(c.incomplete).toBe(false);
    delete process.env.LEGAL_ENTITY_NAME;
    delete process.env.COMPANIES_HOUSE_NUMBER;
    delete process.env.REGISTERED_OFFICE;
  });
});

describe("founding + signup go-live contracts", () => {
  it("migration defines claim_founding_member and doctor flags", () => {
    const mig = read("supabase/migrations/00107_founding_members.sql");
    expect(mig).toContain("is_founding_member");
    expect(mig).toContain("founding_member_number");
    expect(mig).toContain("claim_founding_member");
    expect(mig).toContain("founding_programme");
    expect(mig).toMatch(/max_spots.*100|DEFAULT 100/);
  });

  it("createDoctorAccount enforces UK GMC + city/country and claims founding", () => {
    const auth = read("src/actions/auth.ts");
    expect(auth).toContain("isValidGmcNumber");
    expect(auth).toContain("7-digit GMC");
    expect(auth).toContain("Please select the country where you practise");
    expect(auth).toContain("Please enter your practice city");
    expect(auth).toContain("claimFoundingMembership");
    expect(auth).toContain("terms_accepted_at");
  });

  it("register wizard requires city, country, and GB GMC on step 3", () => {
    const page = read("src/app/[locale]/(public)/register-doctor/page.tsx");
    expect(page).toContain('Please select the country where you practise');
    expect(page).toContain("Please enter your practice city");
    expect(page).toContain("7-digit GMC reference number");
  });

  it("admin grant Clinic uses 3 included seats", () => {
    const admin = read("src/actions/admin.ts");
    expect(admin).toMatch(/clinic:\s*3/);
    expect(admin).not.toMatch(/clinic:\s*5/);
  });

  it("waitlist doctor API is rate limited", () => {
    const route = read("src/app/api/waitlist/doctor/route.ts");
    expect(route).toContain("rateLimit");
    expect(route).toContain("waitlist:doctor:");
    expect(route).toContain("429");
  });

  it("UK legal pages use getCompanyIdentity (no hardcoded TBD_)", () => {
    for (const rel of [
      "src/app/[locale]/(public)/about/about-uk.tsx",
      "src/app/[locale]/(public)/terms/terms-uk.tsx",
      "src/app/[locale]/(public)/privacy/privacy-uk.tsx",
      "src/app/[locale]/(public)/regulatory/regulatory-uk.tsx",
      "src/app/[locale]/(public)/complaints/complaints-uk.tsx",
      "src/app/[locale]/(public)/cookie-policy/cookie-policy-uk.tsx",
    ]) {
      const src = read(rel);
      expect(src, rel).toContain("getCompanyIdentity");
      expect(src, rel).not.toMatch(/=\s*"TBD_/);
    }
  });

  it("gate allows register-testing-service", () => {
    const middleware = read("middleware.ts");
    const vercel = read("vercel.json");
    expect(middleware).toContain('"/register-testing-service"');
    expect(vercel).toMatch(/register-testing-service/);
  });
});
