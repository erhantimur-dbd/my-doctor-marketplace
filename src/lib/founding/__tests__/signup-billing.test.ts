import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  signupBillingPeriod,
  signupBillingPeriodFromSearch,
} from "@/lib/founding/signup-billing";
import { referralMonthFreeAppliesToCheckout } from "@/lib/referrals/reward-policy";

describe("founding signup billing period", () => {
  it("keeps the founding plan monthly when annual is requested", () => {
    expect(
      signupBillingPeriod({ monthlyOnly: true, requested: "annual" })
    ).toBe("monthly");
    expect(
      signupBillingPeriod({ monthlyOnly: false, requested: "annual" })
    ).toBe("annual");
    expect(
      signupBillingPeriodFromSearch({
        tier: "founding",
        founding: "1",
        billing: "annual",
      })
    ).toEqual({ tierLockedMonthly: true, period: "monthly" });
    expect(
      signupBillingPeriodFromSearch({
        tier: "free",
        founding: null,
        billing: "annual",
      }).period
    ).toBe("monthly");
    expect(
      signupBillingPeriodFromSearch({
        tier: "starter",
        founding: null,
        billing: "annual",
      })
    ).toEqual({ tierLockedMonthly: false, period: "annual" });
  });

  it("does not advertise 2 months free while the founding plan is selected", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/[locale]/(public)/register-doctor/page.tsx"),
      "utf8"
    );
    expect(page).toContain("signupBillingPeriod");
    expect(page).toContain("signupBillingPeriodFromSearch");
    expect(page).toContain("effectiveBillingPeriod === \"annual\"");
    expect(page).not.toContain("{billingPeriod === \"annual\" && (");
    const faq = readFileSync(
      join(process.cwd(), "public/coming-soon/index.html"),
      "utf8"
    );
    expect(faq).toMatch(/founding plan is monthly only/i);
    expect(faq).not.toMatch(
      /Annual billing is 10 months for 12 \(2 months free\)\./
    );
  });
});

describe("founding price and the referral free month", () => {
  it("does not put a 100% referral coupon on the founding plan", () => {
    expect(
      referralMonthFreeAppliesToCheckout({
        tier: "founding",
        priceId: "price_founding",
        foundingPriceId: "price_founding",
      })
    ).toBe(false);
    expect(
      referralMonthFreeAppliesToCheckout({
        tier: "starter",
        priceId: "price_starter",
        foundingPriceId: "price_founding",
      })
    ).toBe(true);
    expect(
      referralMonthFreeAppliesToCheckout({
        priceId: "price_founding",
        foundingPriceId: "price_founding",
      })
    ).toBe(false);

    const reward = readFileSync(
      join(process.cwd(), "src/lib/referrals/internal.ts"),
      "utf8"
    );
    expect(reward).toContain("referralMonthFreeAppliesToTier");
    expect(reward).toContain("if (rewardApplied && referrer)");
    const checkout = readFileSync(
      join(process.cwd(), "src/actions/doctor.ts"),
      "utf8"
    );
    expect(checkout).toContain("referralMonthFreeAppliesToCheckout");
  });

  it("does not tell a founding signup that the first month is free", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/[locale]/(public)/register-doctor/page.tsx"),
      "utf8"
    );
    expect(page).toContain("selectedTier === \"founding\"");
    expect(page).toMatch(/does not make the first month free/);
    expect(page).toMatch(/founding plan stays £99/);
  });
});
