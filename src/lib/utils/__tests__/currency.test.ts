import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  centsToAmount,
  amountToCents,
  getBookingFeeCents,
  getCommissionCents,
  calculateDepositCents,
  isDepositSufficient,
  PLATFORM_COMMISSION_PERCENT,
} from "../currency";

// ─── formatCurrency ──────────────────────────────────────────────

describe("formatCurrency", () => {
  it("formats GBP correctly", () => {
    expect(formatCurrency(15000, "GBP")).toBe("£150.00");
  });

  it("formats EUR correctly", () => {
    expect(formatCurrency(15000, "EUR")).toBe("€150.00");
  });

  it("formats USD correctly", () => {
    expect(formatCurrency(9999, "USD")).toBe("US$99.99");
  });

  it("formats TRY without decimals", () => {
    const result = formatCurrency(250000, "TRY");
    // TRY should have 0 decimal places
    expect(result).not.toContain(".");
  });

  it("handles zero correctly", () => {
    expect(formatCurrency(0, "GBP")).toBe("£0.00");
  });

  it("converts cents to display amount (e.g. 495 cents → £4.95)", () => {
    expect(formatCurrency(495, "GBP")).toBe("£4.95");
  });
});

// ─── centsToAmount / amountToCents ───────────────────────────────

describe("centsToAmount", () => {
  it("converts cents to decimal amount", () => {
    expect(centsToAmount(495)).toBe(4.95);
    expect(centsToAmount(15000)).toBe(150);
    expect(centsToAmount(0)).toBe(0);
  });
});

describe("amountToCents", () => {
  it("converts decimal amount to cents", () => {
    expect(amountToCents(4.95)).toBe(495);
    expect(amountToCents(150)).toBe(15000);
    expect(amountToCents(0)).toBe(0);
  });

  it("rounds to avoid floating point errors", () => {
    // 19.99 * 100 = 1998.9999... without rounding
    expect(amountToCents(19.99)).toBe(1999);
  });
});

// ─── getBookingFeeCents ──────────────────────────────────────────

describe("getBookingFeeCents", () => {
  it("returns £4.95 (495 cents) for GBP", () => {
    expect(getBookingFeeCents("GBP")).toBe(495);
  });

  it("returns a converted fee for EUR", () => {
    const eurFee = getBookingFeeCents("EUR");
    // EUR fee should be higher than GBP (exchange rate > 1)
    expect(eurFee).toBeGreaterThan(495);
    // Should be a whole number (Math.round applied)
    expect(eurFee).toBe(Math.round(eurFee));
  });

  it("returns a converted fee for USD", () => {
    const usdFee = getBookingFeeCents("USD");
    expect(usdFee).toBeGreaterThan(495);
    expect(usdFee).toBe(Math.round(usdFee));
  });

  it("returns a converted fee for TRY", () => {
    const tryFee = getBookingFeeCents("TRY");
    // TRY rate is ~58x, so fee should be much higher
    expect(tryFee).toBeGreaterThan(20000);
    expect(tryFee).toBe(Math.round(tryFee));
  });

  it("falls back to 1.0 rate for unknown currencies", () => {
    expect(getBookingFeeCents("XYZ")).toBe(495);
  });
});

// ─── getCommissionCents ──────────────────────────────────────────

describe("getCommissionCents", () => {
  it("calculates 15% commission", () => {
    expect(PLATFORM_COMMISSION_PERCENT).toBe(15);
    expect(getCommissionCents(10000)).toBe(1500); // £100 → £15
  });

  it("rounds to nearest cent", () => {
    // 15% of 1111 = 166.65 → rounds to 167
    expect(getCommissionCents(1111)).toBe(167);
  });

  it("handles zero", () => {
    expect(getCommissionCents(0)).toBe(0);
  });
});

// ─── calculateDepositCents ───────────────────────────────────────

describe("calculateDepositCents", () => {
  it("calculates percentage deposit correctly", () => {
    // 30% of £200.00 (20000 cents) = £60.00 (6000 cents)
    expect(calculateDepositCents(20000, "percentage", 30)).toBe(6000);
  });

  it("calculates flat deposit correctly", () => {
    expect(calculateDepositCents(20000, "flat", 5000)).toBe(5000);
  });

  it("caps flat deposit at consultation fee", () => {
    // Flat deposit of £300 on a £200 consultation should cap at £200
    expect(calculateDepositCents(20000, "flat", 30000)).toBe(20000);
  });

  it("returns null for 'none' deposit type", () => {
    expect(calculateDepositCents(20000, "none", 30)).toBeNull();
  });

  it("returns null for null deposit type", () => {
    expect(calculateDepositCents(20000, null, 30)).toBeNull();
  });

  it("returns null for undefined deposit type", () => {
    expect(calculateDepositCents(20000, undefined, 30)).toBeNull();
  });

  it("returns null when deposit value is null", () => {
    expect(calculateDepositCents(20000, "percentage", null)).toBeNull();
  });

  it("returns null for unknown deposit type", () => {
    expect(calculateDepositCents(20000, "unknown", 30)).toBeNull();
  });

  it("rounds percentage deposits to whole cents", () => {
    // 30% of 3333 = 999.9 → rounds to 1000
    expect(calculateDepositCents(3333, "percentage", 30)).toBe(1000);
  });
});

// ─── isDepositSufficient ─────────────────────────────────────────

describe("isDepositSufficient", () => {
  it("returns true when deposit covers commission", () => {
    // 15% of £200 = £30. Deposit of £60 is sufficient.
    expect(isDepositSufficient(6000, 20000)).toBe(true);
  });

  it("returns true when deposit exactly equals commission", () => {
    // 15% of £100 = £15. Deposit of exactly £15.
    expect(isDepositSufficient(1500, 10000)).toBe(true);
  });

  it("returns false when deposit is below commission", () => {
    // 15% of £200 = £30. Deposit of £20 is insufficient.
    expect(isDepositSufficient(2000, 20000)).toBe(false);
  });
});
