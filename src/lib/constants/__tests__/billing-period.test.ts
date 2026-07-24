import { describe, expect, it } from "vitest";
import {
  ANNUAL_BILLED_MONTHS,
  ANNUAL_FREE_MONTHS,
  annualDiscountPercent,
  annualEffectiveMonthlyPence,
  annualTotalPence,
} from "@/lib/constants/billing-period";
import { formatAnnualEffectiveMonthlyForLocale } from "@/lib/constants/license-tiers";

describe("annual billing (2 months free)", () => {
  it("charges 10 months for a year", () => {
    expect(ANNUAL_FREE_MONTHS).toBe(2);
    expect(ANNUAL_BILLED_MONTHS).toBe(10);
    // Starter £199/mo → £1,990/year
    expect(annualTotalPence(19900)).toBe(199000);
  });

  it("effective monthly is total/12", () => {
    // 19900 * 10 / 12 = 16583.33 → 16583
    expect(annualEffectiveMonthlyPence(19900)).toBe(
      Math.round((19900 * 10) / 12)
    );
    expect(annualEffectiveMonthlyPence(0)).toBe(0);
  });

  it("discount is ~16.7%", () => {
    expect(annualDiscountPercent()).toBe(16.7);
  });

  it("display effective monthly is whole pounds (no decimals)", () => {
    // Marketing shows rounded £/mo; Stripe still charges exact 10× monthly
    expect(formatAnnualEffectiveMonthlyForLocale(19900, "en")).toBe("£166");
    expect(formatAnnualEffectiveMonthlyForLocale(29900, "en")).toBe("£249");
    expect(formatAnnualEffectiveMonthlyForLocale(149500, "en")).toBe("£1,246");
  });
});
