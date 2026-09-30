import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/billing/currency-for-country", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/billing/currency-for-country")
  >();
  return {
    ...actual,
    ENABLED_CURRENCIES: ["GBP", "EUR"],
  };
});

import { ENABLED_CURRENCIES } from "@/lib/billing/currency-for-country";
import {
  displayCurrency,
  resolveDisplayCurrency,
} from "@/lib/billing/display-currency";
import {
  formatPriceForLocale,
  getDisplayCurrency,
} from "@/lib/constants/license-tiers";

describe("display currency when EUR is enabled", () => {
  it("maps a Spanish browser to EUR", () => {
    expect(ENABLED_CURRENCIES).toEqual(["GBP", "EUR"]);
    expect(displayCurrency({ locale: "es" })).toBe("EUR");
    expect(displayCurrency({ country: "ES" })).toBe("EUR");
    expect(getDisplayCurrency("es")).toBe("EUR");
    const formatted = formatPriceForLocale(19900, "es");
    expect(formatted).toMatch(/€/);
    expect(formatted).not.toMatch(/£/);
  });

  it("keeps a stored EUR cookie once EUR can be charged", () => {
    expect(
      resolveDisplayCurrency({ locale: "en", stored: "EUR" })
    ).toEqual({ currency: "EUR", clearStored: false });
  });

  it("still falls back to GBP for a currency that stays off", () => {
    expect(displayCurrency({ country: "US" })).toBe("GBP");
    expect(displayCurrency({ locale: "en" })).toBe("GBP");
  });
});
