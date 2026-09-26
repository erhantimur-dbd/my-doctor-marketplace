import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/offers/current-price", () => ({
  resolveLatestAnnualPrice: vi.fn(async () => ({
    stripePriceId: "price_from_catalog",
    amountPence: 1,
  })),
}));

import { getOrCreateLicensePriceId } from "@/lib/constants/license-tiers";
import { resolveLatestAnnualPrice } from "@/lib/offers/current-price";

describe("public annual checkout price", () => {
  beforeEach(() => {
    vi.mocked(resolveLatestAnnualPrice).mockClear();
    process.env.STRIPE_PRICE_STARTER_ANNUAL = "price_env_solo_annual";
    process.env.STRIPE_PRICE_PROFESSIONAL_ANNUAL = "price_env_pro_annual";
  });

  it("uses STRIPE_PRICE_*_ANNUAL and ignores plan_price_versions", async () => {
    const solo = await getOrCreateLicensePriceId("starter", {} as never, "annual");
    const pro = await getOrCreateLicensePriceId("professional", {} as never, "annual");
    expect(solo).toBe("price_env_solo_annual");
    expect(pro).toBe("price_env_pro_annual");
    expect(resolveLatestAnnualPrice).not.toHaveBeenCalled();
  });
});
