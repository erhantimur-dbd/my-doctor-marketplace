import type { AnnualPlanId, OfferKind } from "@/lib/offers/plans";

export type ExampleOffer = {
  slug: string;
  name: string;
  kind: OfferKind;
  percentOff: number | null;
  trialDays: number | null;
  eligiblePlans: AnnualPlanId[];
};

/** Seeded by scripts/seed-subscription-offers.ts. Not inserted by the migration. */
export const EXAMPLE_OFFERS: ExampleOffer[] = [
  {
    slug: "fifty-off-first-year",
    name: "50% off first year",
    kind: "percent_first_year",
    percentOff: 50,
    trialDays: null,
    eligiblePlans: ["starter_annual", "professional_annual"],
  },
  {
    slug: "twenty-five-off-first-year",
    name: "25% off first year",
    kind: "percent_first_year",
    percentOff: 25,
    trialDays: null,
    eligiblePlans: ["starter_annual", "professional_annual"],
  },
  {
    slug: "free-3-months",
    name: "Free for 3 months",
    kind: "free_trial",
    percentOff: null,
    trialDays: 90,
    eligiblePlans: ["starter_annual", "professional_annual"],
  },
];

export const SEED_ANNUAL_PRICES = [
  {
    tier: "starter" as const,
    planId: "starter_annual" as const,
    lookupKey: "md360_starter_annual",
    amountPence: 199_000,
    productName: "MyDoctors360 Solo (annual)",
    envVar: "STRIPE_PRICE_STARTER_ANNUAL",
  },
  {
    tier: "professional" as const,
    planId: "professional_annual" as const,
    lookupKey: "md360_professional_annual",
    amountPence: 299_000,
    productName: "MyDoctors360 Pro (annual)",
    envVar: "STRIPE_PRICE_PROFESSIONAL_ANNUAL",
  },
];
