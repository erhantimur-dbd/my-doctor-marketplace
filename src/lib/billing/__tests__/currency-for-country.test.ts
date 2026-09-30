import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ENABLED_CURRENCIES,
  currencyForCountry,
} from "@/lib/billing/currency-for-country";

describe("currencyForCountry", () => {
  it("maps a GB sign-up to GBP while GBP is the enabled launch currency", () => {
    expect(ENABLED_CURRENCIES).toEqual(["GBP"]);
    expect(currencyForCountry("GB")).toBe("GBP");
    expect(currencyForCountry(" gb ")).toBe("GBP");
  });

  it("returns null for countries that are not enabled so callers keep the database default", () => {
    expect(currencyForCountry("DE")).toBeNull();
    expect(currencyForCountry("IE")).toBeNull();
    expect(currencyForCountry("US")).toBeNull();
    expect(currencyForCountry("TR")).toBeNull();
    expect(currencyForCountry(null)).toBeNull();
    expect(currencyForCountry("")).toBeNull();
  });

  it("GB organisation insert uses the helper and does not hardcode a currency", () => {
    const auth = readFileSync(join(process.cwd(), "src/actions/auth.ts"), "utf8");
    const start = auth.indexOf("async function createDoctorAccount");
    const end = auth.indexOf("export async function registerDoctor");
    const body = auth.slice(start, end);
    expect(body).toContain("currencyForCountry(countryCode)");
    expect(body).toContain("base_currency: signupCurrency");
    const orgInsert = body.slice(body.indexOf('.from("organizations")'));
    expect(orgInsert.slice(0, orgInsert.indexOf(".select"))).not.toMatch(
      /base_currency:\s*["']GBP["']/
    );
    expect(orgInsert.slice(0, orgInsert.indexOf(".select"))).not.toMatch(
      /base_currency:\s*["']EUR["']/
    );
  });
});
