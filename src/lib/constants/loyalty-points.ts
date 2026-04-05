// Loyalty Points Configuration
// Points are earned on every completed booking and can be redeemed for discounts.

export const POINTS_PER_POUND = 10; // Base earning rate: 10 points per £1 spent
export const POINTS_REDEMPTION_RATE = 100; // 100 points = £1 discount

export const LOYALTY_TIERS = [
  {
    name: "Gold",
    icon: "🥇",
    minPoints: 6000,
    multiplier: 2.0, // 20 pts/£1
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
  },
  {
    name: "Silver",
    icon: "🥈",
    minPoints: 2000,
    multiplier: 1.5, // 15 pts/£1
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
  },
  {
    name: "Bronze",
    icon: "🥉",
    minPoints: 0,
    multiplier: 1.0, // 10 pts/£1
    color: "text-amber-700",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
] as const;

export type LoyaltyTier = (typeof LOYALTY_TIERS)[number];

export function getTierForPoints(lifetimePoints: number): LoyaltyTier {
  return LOYALTY_TIERS.find((t) => lifetimePoints >= t.minPoints) || LOYALTY_TIERS[2];
}

export function getNextTier(lifetimePoints: number): LoyaltyTier | null {
  const current = getTierForPoints(lifetimePoints);
  const currentIndex = LOYALTY_TIERS.indexOf(current);
  return currentIndex > 0 ? LOYALTY_TIERS[currentIndex - 1] : null;
}

export function calculatePointsEarned(amountCents: number, lifetimePoints: number): number {
  const tier = getTierForPoints(lifetimePoints);
  const pounds = amountCents / 100;
  return Math.round(pounds * POINTS_PER_POUND * tier.multiplier);
}

export function pointsToDiscount(points: number): number {
  // Returns discount in cents
  return Math.floor(points / POINTS_REDEMPTION_RATE) * 100;
}

export function getEffectiveRate(lifetimePoints: number): number {
  const tier = getTierForPoints(lifetimePoints);
  return Math.round(POINTS_PER_POUND * tier.multiplier);
}
