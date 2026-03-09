import type { LicenseTier } from "@/types";

// ─── Currency & Exchange Rates ─────────────────────────────
export const BASE_CURRENCY = "GBP";

/** Approximate exchange rates from GBP. Updated periodically. */
export const EXCHANGE_RATES: Record<string, number> = {
  GBP: 1.0,
  EUR: 1.15,
  USD: 1.27,
  TRY: 41.5,
};

/** Convert a GBP pence amount to another currency's minor unit */
export function convertPrice(
  penceGBP: number,
  targetCurrency: string
): number {
  const rate = EXCHANGE_RATES[targetCurrency] ?? 1.0;
  return Math.round(penceGBP * rate);
}

/** Map a locale to its display currency */
export function getDisplayCurrency(locale: string): string {
  switch (locale) {
    case "en":
      return "GBP";
    case "tr":
      return "TRY";
    case "ja":
    case "zh":
      return "USD";
    default:
      return "EUR"; // de, fr, es, it, pt
  }
}

/** Format a price in minor units for display */
export function formatPrice(
  minorUnits: number,
  currency: string
): string {
  const majorUnits = minorUnits / 100;
  const localeMap: Record<string, string> = {
    GBP: "en-GB",
    EUR: "de-DE",
    USD: "en-US",
    TRY: "tr-TR",
  };
  return new Intl.NumberFormat(localeMap[currency] ?? "en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(majorUnits);
}

/** Format price in the locale's currency, converting from GBP pence */
export function formatPriceForLocale(
  penceGBP: number,
  locale: string
): string {
  const currency = getDisplayCurrency(locale);
  const converted = convertPrice(penceGBP, currency);
  return formatPrice(converted, currency);
}

// ─── Tier Config ───────────────────────────────────────────

export interface LicenseTierConfig {
  id: LicenseTier;
  name: string;
  description: string;
  priceMonthlyPence: number; // GBP pence (base currency)
  perUser: boolean; // true = price is per seat
  defaultSeats: number;
  maxSeats: number;
  includedSeats: number; // seats included in base price
  extraSeatPricePence: number; // GBP pence per extra seat/month
  commitmentMonths: number; // minimum commitment period (e.g. 12)
  features: string[];
  excludedFeatures?: string[]; // features NOT available on this tier
  popular?: boolean;
  isCustomPricing?: boolean;
  isFreeTier?: boolean;
}

export const LICENSE_TIERS: LicenseTierConfig[] = [
  {
    id: "free",
    name: "Free",
    description: "Get started with a basic doctor profile",
    priceMonthlyPence: 0,
    perUser: false,
    defaultSeats: 1,
    maxSeats: 1,
    includedSeats: 1,
    extraSeatPricePence: 0,
    commitmentMonths: 0, // no commitment on free
    features: [
      "Doctor profile listing",
    ],
    excludedFeatures: [
      "Online bookings",
      "Email reminders",
      "Video consultations",
      "SMS & WhatsApp reminders",
      "Analytics",
      "Patient CRM",
      "Treatment plans",
      "Priority support",
    ],
    isFreeTier: true,
  },
  {
    id: "starter",
    name: "Starter",
    description: "Full booking & video for solo practitioners",
    priceMonthlyPence: 19900, // £199
    perUser: false,
    defaultSeats: 1,
    maxSeats: 1,
    includedSeats: 1,
    extraSeatPricePence: 0,
    commitmentMonths: 12,
    features: [
      "1 doctor profile",
      "Online booking calendar",
      "Unlimited bookings",
      "Email reminders",
      "Video consultations",
      "SMS & WhatsApp reminders",
    ],
    excludedFeatures: [
      "Advanced analytics",
      "Patient CRM",
      "Treatment plans",
      "Priority support",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    description: "Advanced tools for growing practices",
    priceMonthlyPence: 29900, // £299 per user
    perUser: true,
    defaultSeats: 1,
    maxSeats: 4,
    includedSeats: 1,
    extraSeatPricePence: 29900, // £299 per additional user
    commitmentMonths: 12,
    features: [
      "1–4 doctor profiles",
      "Advanced analytics",
      "Patient CRM",
      "Treatment plans",
      "Priority support",
    ],
    popular: true,
  },
  {
    id: "clinic",
    name: "Clinic Starter Pack",
    description: "Everything you need to launch your clinic online",
    priceMonthlyPence: 149500, // £1,495
    perUser: false,
    defaultSeats: 5,
    maxSeats: 15,
    includedSeats: 5,
    extraSeatPricePence: 29900, // £299 per extra seat
    commitmentMonths: 12,
    features: [
      "Multi-location clinic",
      "5 doctor profiles included",
      "Add up to 15 doctors with add-ons",
      "3 hours of dedicated onboarding",
      "Custom branding on your profile",
      "Centralized clinic dashboard",
      "Multi-doctor scheduling",
      "Team performance analytics",
      "Dedicated account manager",
      "Priority support",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Custom solutions for large healthcare organizations",
    priceMonthlyPence: 0,
    perUser: false,
    defaultSeats: 999,
    maxSeats: 999,
    includedSeats: 999,
    extraSeatPricePence: 0,
    commitmentMonths: 12,
    features: [
      "15+ doctor profiles",
      "Multiple locations",
      "Custom branding",
      "Medical testing services included",
      "Custom integrations & API access",
      "SLA guarantee",
      "Dedicated account manager",
    ],
    isCustomPricing: true,
  },
];

// ─── Platform Constants ────────────────────────────────────

/** Fixed platform booking fee percentage — same for all tiers */
export const PLATFORM_BOOKING_FEE_PERCENT = 15;

/** Extra seat price in GBP pence per month */
export const EXTRA_SEAT_PRICE_PENCE = 29900;

// ─── Module Add-ons ────────────────────────────────────────

export interface ModuleConfig {
  key: string;
  name: string;
  description: string;
  priceMonthlyPence: number; // GBP pence
}

export const AVAILABLE_MODULES: ModuleConfig[] = [
  {
    key: "medical_testing",
    name: "Medical Testing",
    description: "List diagnostic services and set test-specific pricing",
    priceMonthlyPence: 4900, // £49
  },
];

// ─── Testing Standalone Plan (separate product) ────────────

export const TESTING_STANDALONE_PLAN = {
  id: "testing_standalone",
  name: "Medical Testing",
  description: "For labs, clinics & nurses offering diagnostic services",
  priceMonthlyPence: 9900, // £99
  features: [
    "Online booking calendar",
    "Unlimited bookings",
    "Email reminders",
    "SMS & WhatsApp reminders",
  ],
};

// ─── Helpers ───────────────────────────────────────────────

/** Look up a tier config by its ID */
export function getLicenseTier(
  tierId: string
): LicenseTierConfig | undefined {
  return LICENSE_TIERS.find((t) => t.id === tierId);
}

/** Look up a module config by its key */
export function getModuleConfig(
  moduleKey: string
): ModuleConfig | undefined {
  return AVAILABLE_MODULES.find((m) => m.key === moduleKey);
}

/** Get only the paid tiers (excludes free and enterprise) */
export function getPaidTiers(): LicenseTierConfig[] {
  return LICENSE_TIERS.filter(
    (t) => !t.isFreeTier && !t.isCustomPricing
  );
}

/** Get all displayable tiers (excludes enterprise for checkout) */
export function getCheckoutTiers(): LicenseTierConfig[] {
  return LICENSE_TIERS.filter((t) => !t.isCustomPricing);
}
