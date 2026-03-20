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
// TODO: If you haven't created these Stripe prices yet in your Stripe Dashboard,
// you'll need to create products/prices for each paid tier and then add the
// price IDs (e.g. `price_1Abc...`) to Vercel's environment variables:
//   STRIPE_PRICE_STARTER      → Starter plan (£199/mo, annual)
//   STRIPE_PRICE_PROFESSIONAL → Professional plan (£299/mo per user, annual)
//   STRIPE_PRICE_CLINIC       → Clinic Starter Pack (£1,495/mo, annual)
// Also add the extra-seat add-on price if you charge for additional seats:
//   STRIPE_PRICE_EXTRA_SEAT   → Extra seat (£299/mo, annual)

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
    maxSeats: 1, // single seat only — upgrade to Professional for more
    includedSeats: 1,
    extraSeatPricePence: 0, // no add-on seats — must upgrade
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
    maxSeats: 15, // 5 included + up to 10 extras = 15 total
    includedSeats: 5,
    extraSeatPricePence: 29900, // £299 per extra seat
    commitmentMonths: 12,
    features: [
      "Multi-location clinic",
      "5 doctor profiles included",
      "Add up to 10 extra seats (15 total)",
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

/**
 * Get or create a reusable Stripe price for extra seats.
 *
 * Uses STRIPE_PRICE_EXTRA_SEAT env var if set (recommended for production).
 * Otherwise creates a price on-the-fly and caches the ID for the session.
 */
let _cachedSeatPriceId: string | null = null;

export async function getOrCreateExtraSeatPriceId(): Promise<string> {
  // 1. Use env var if configured (recommended)
  if (process.env.STRIPE_PRICE_EXTRA_SEAT) {
    return process.env.STRIPE_PRICE_EXTRA_SEAT;
  }

  // 2. Return cached value if we already created one this session
  if (_cachedSeatPriceId) return _cachedSeatPriceId;

  // 3. Search for existing price in Stripe
  const { getStripe } = await import("@/lib/stripe/client");
  const stripe = getStripe();

  const existingPrices = await stripe.prices.search({
    query: 'metadata["type"]:"extra_seat" active:"true"',
    limit: 1,
  });

  if (existingPrices.data.length > 0) {
    _cachedSeatPriceId = existingPrices.data[0].id;
    return _cachedSeatPriceId;
  }

  // 4. Create one if none exists
  const price = await stripe.prices.create({
    currency: "gbp",
    unit_amount: EXTRA_SEAT_PRICE_PENCE,
    recurring: { interval: "month" },
    product_data: {
      name: "Extra Doctor Seat",
      metadata: { type: "extra_seat" },
    },
    metadata: { type: "extra_seat" },
  });

  _cachedSeatPriceId = price.id;
  return _cachedSeatPriceId;
}
