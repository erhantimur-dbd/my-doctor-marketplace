import type { LicenseTier } from "@/types";

export interface LicenseTierConfig {
  id: LicenseTier;
  name: string;
  description: string;
  priceMonthly: number; // EUR cents
  priceAnnual: number; // EUR cents (discounted)
  prices: Record<string, number>; // currency -> cents
  defaultSeats: number;
  maxSeats: number;
  extraSeatPrice: number; // EUR cents per extra seat/mo
  features: string[];
  popular?: boolean;
  isCustomPricing?: boolean;
}

export const LICENSE_TIERS: LicenseTierConfig[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Perfect for solo practitioners",
    priceMonthly: 4900,
    priceAnnual: 47000,
    prices: { EUR: 4900, GBP: 3900, TRY: 186900, USD: 4900 },
    defaultSeats: 1,
    maxSeats: 1,
    extraSeatPrice: 2900,
    features: [
      "1 doctor profile",
      "Online booking calendar",
      "Unlimited bookings",
      "Email & SMS reminders",
      "Basic analytics",
      "Patient CRM",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    description: "For growing practices",
    priceMonthly: 14900,
    priceAnnual: 143000,
    prices: { EUR: 14900, GBP: 12900, TRY: 569900, USD: 14900 },
    defaultSeats: 3,
    maxSeats: 3,
    extraSeatPrice: 2900,
    features: [
      "Everything in Starter",
      "Up to 3 doctor profiles",
      "Video consultations",
      "Treatment plans",
      "Advanced analytics",
      "Priority support",
    ],
    popular: true,
  },
  {
    id: "clinic",
    name: "Clinic",
    description: "For multi-doctor clinics",
    priceMonthly: 39900,
    priceAnnual: 383000,
    prices: { EUR: 39900, GBP: 34900, TRY: 1519900, USD: 39900 },
    defaultSeats: 5,
    maxSeats: 15,
    extraSeatPrice: 2900,
    features: [
      "Everything in Professional",
      "5–15 doctor profiles",
      "Centralized clinic dashboard",
      "Multi-doctor scheduling",
      "Team performance analytics",
      "Staff accounts (receptionist)",
      "Dedicated onboarding",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For hospital networks and large organizations",
    priceMonthly: 0,
    priceAnnual: 0,
    prices: { EUR: 0, GBP: 0, TRY: 0, USD: 0 },
    defaultSeats: 999,
    maxSeats: 999,
    extraSeatPrice: 0,
    features: [
      "Everything in Clinic",
      "Unlimited doctor profiles",
      "Custom integrations & API access",
      "SLA guarantee",
      "Dedicated account manager",
      "Custom branding (coming soon)",
    ],
    isCustomPricing: true,
  },
];

/** Fixed platform booking fee percentage — same for all tiers */
export const PLATFORM_BOOKING_FEE_PERCENT = 12;

/** Price per extra seat beyond the tier's included count (EUR cents/month) */
export const EXTRA_SEAT_PRICE_CENTS = 2900;

export interface ModuleConfig {
  key: string;
  name: string;
  description: string;
  priceMonthly: number;
  prices: Record<string, number>;
}

export const AVAILABLE_MODULES: ModuleConfig[] = [
  {
    key: "medical_testing",
    name: "Medical Testing",
    description: "List diagnostic services and set test-specific pricing",
    priceMonthly: 4900,
    prices: { EUR: 4900, GBP: 3900, TRY: 186900, USD: 4900 },
  },
];

/** Look up a tier config by its ID */
export function getLicenseTier(tierId: string): LicenseTierConfig | undefined {
  return LICENSE_TIERS.find((t) => t.id === tierId);
}

/** Look up a module config by its key */
export function getModuleConfig(moduleKey: string): ModuleConfig | undefined {
  return AVAILABLE_MODULES.find((m) => m.key === moduleKey);
}
