import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fallbackOrganizationCurrency } from "@/lib/billing/currency-for-country";
import {
  displayCurrency,
  enabledDisplayCurrencyOptions,
  resolveDisplayCurrency,
} from "@/lib/billing/display-currency";
import {
  formatPriceForLocale,
  getDisplayCurrency,
} from "@/lib/constants/license-tiers";

const EUROPEAN_LOCALES = ["es", "de", "fr", "it", "pt"] as const;

describe("displayCurrency", () => {
  it("shows GBP and £ for European-language browsers while EUR is off", () => {
    for (const locale of EUROPEAN_LOCALES) {
      expect(displayCurrency({ locale })).toBe("GBP");
      expect(getDisplayCurrency(locale)).toBe("GBP");
      const formatted = formatPriceForLocale(19900, locale);
      expect(formatted).toBe(formatPriceForLocale(19900, "en"));
      expect(formatted).toMatch(/£/);
      expect(formatted).not.toMatch(/€/);
      expect(formatted).not.toMatch(/EUR/);
    }
  });

  it("maps those countries to GBP as well", () => {
    for (const country of ["ES", "DE", "FR", "IT", "PT"]) {
      expect(displayCurrency({ country })).toBe("GBP");
    }
  });

  it("ignores a stored EUR cookie and asks the caller to clear it", () => {
    expect(
      resolveDisplayCurrency({ locale: "es", stored: "EUR" })
    ).toEqual({ currency: "GBP", clearStored: true });
    expect(
      resolveDisplayCurrency({ locale: "de", stored: "eur" })
    ).toEqual({ currency: "GBP", clearStored: true });
  });

  it("keeps a stored GBP cookie", () => {
    expect(
      resolveDisplayCurrency({ locale: "es", stored: "GBP" })
    ).toEqual({ currency: "GBP", clearStored: false });
  });

  it("offers only the enabled currency, so the selector stays hidden", () => {
    expect(enabledDisplayCurrencyOptions().map((c) => c.code)).toEqual([
      "GBP",
    ]);
    const selector = readFileSync(
      join(process.cwd(), "src/components/layout/currency-selector.tsx"),
      "utf8"
    );
    expect(selector).toContain("enabledDisplayCurrencyOptions");
    expect(selector).toContain("options.length < 2");
  });

  it("wires the provider's initial value through the same resolver", () => {
    const provider = readFileSync(
      join(process.cwd(), "src/providers/currency-provider.tsx"),
      "utf8"
    );
    const initialiser = provider.slice(
      provider.indexOf("useState"),
      provider.indexOf("const [rates")
    );
    expect(initialiser).toContain("resolveDisplayCurrency");
    expect(provider).toContain("clearStored");
    expect(provider).not.toContain('return "EUR"');
  });
});

describe("organisation currency fallback", () => {
  it("is GBP when the country is missing or its currency is not enabled", () => {
    expect(fallbackOrganizationCurrency(undefined)).toBe("GBP");
    expect(fallbackOrganizationCurrency("")).toBe("GBP");
    expect(fallbackOrganizationCurrency("DE")).toBe("GBP");
    expect(fallbackOrganizationCurrency("ES")).toBe("GBP");
    expect(fallbackOrganizationCurrency("GB")).toBe("GBP");
  });

  it("uses the helper in the manual organisation create action", () => {
    const source = readFileSync(
      join(process.cwd(), "src/actions/organization.ts"),
      "utf8"
    );
    const start = source.indexOf("export async function createOrganization");
    const end = source.indexOf("export async function getMyOrganization");
    const body = source.slice(start, end);
    expect(body).toContain("fallbackOrganizationCurrency(country)");
    expect(body).not.toMatch(/["']EUR["']/);
    expect(body).not.toMatch(/["']GBP["']/);

    const settings = readFileSync(
      join(
        process.cwd(),
        "src/app/[locale]/(doctor)/doctor-dashboard/organization/settings/page.tsx"
      ),
      "utf8"
    );
    expect(settings).toContain("fallbackOrganizationCurrency");
    expect(settings).not.toMatch(/base_currency \|\| ["']EUR["']/);
  });
});

describe("doctors base currency default", () => {
  it("migration 00122 sets the default to GBP and does not backfill", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/00122_doctors_base_currency_default_gbp.sql"
      ),
      "utf8"
    );
    expect(sql).toMatch(
      /ALTER TABLE public\.doctors\s+ALTER COLUMN base_currency SET DEFAULT 'GBP'/
    );
    const statements = sql.replace(/--.*$/gm, "");
    expect(statements).not.toMatch(/\bUPDATE\b/i);
    expect(statements).not.toMatch(/\bINSERT\b/i);
  });
});
