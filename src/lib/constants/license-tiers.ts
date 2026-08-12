import type { LicenseTier } from "@/types";
import { PACKAGE_MARKETING } from "@/lib/constants/package-features";

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
  currency: string,
  options?: { fractionDigits?: number }
): string {
  const majorUnits = minorUnits / 100;
  const digits = options?.fractionDigits ?? 0;
  const localeMap: Record<string, string> = {
    GBP: "en-GB",
    EUR: "de-DE",
    USD: "en-US",
    TRY: "tr-TR",
  };
  return new Intl.NumberFormat(localeMap[currency] ?? "en-GB", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(majorUnits);
}

/** Format price in the locale's currency, converting from GBP pence */
export function formatPriceForLocale(
  penceGBP: number,
  locale: string,
  options?: { fractionDigits?: number }
): string {
  const currency = getDisplayCurrency(locale);
  const converted = convertPrice(penceGBP, currency);
  return formatPrice(converted, currency, options);
}

/**
 * Annual effective monthly for display — whole major units (no decimals).
 * Uses (10 × monthly) / 12, rounded. Stripe still charges exact 10× monthly.
 * e.g. £1,990/yr → £166/mo display (199000/12 → 16583.33 pence → £166).
 */
export function formatAnnualEffectiveMonthlyForLocale(
  monthlyPenceGBP: number,
  locale: string
): string {
  // Inline 10× rule to avoid circular imports with billing-period
  const yearlyPence = monthlyPenceGBP <= 0 ? 0 : monthlyPenceGBP * 10;
  const currency = getDisplayCurrency(locale);
  const yearlyMinor = convertPrice(yearlyPence, currency);
  const effectiveMinor = Math.round(yearlyMinor / 12);
  return formatPrice(effectiveMinor, currency, { fractionDigits: 0 });
}

// ─── Tier Config ───────────────────────────────────────────
// TODO: If you haven't created these Stripe prices yet in your Stripe Dashboard,
// you'll need to create products/prices for each paid tier and then add the
// price IDs (e.g. `price_1Abc...`) to Vercel's environment variables:
//   STRIPE_PRICE_STARTER      → Starter plan (£199/mo, annual)
//   STRIPE_PRICE_PROFESSIONAL → Professional plan (£299/mo flat, 1 seat, annual)
//   STRIPE_PRICE_CLINIC       → Clinic (£897/mo = 3×£299, annual)
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
  /** Contract length for annual billing only (monthly is month-to-month). */
  commitmentMonths: number;
  features: string[];
  excludedFeatures?: string[]; // features NOT available on this tier
  popular?: boolean;
  isCustomPricing?: boolean;
  isFreeTier?: boolean;
}

export const LICENSE_TIERS: LicenseTierConfig[] = [
  {
    id: "free",
    name: "Founding Free",
    description: "List your profile and prepare for launch",
    priceMonthlyPence: 0,
    perUser: false,
    defaultSeats: 1,
    maxSeats: 1,
    includedSeats: 1,
    extraSeatPricePence: 0,
    commitmentMonths: 0, // no commitment on free
    features: PACKAGE_MARKETING.free.features,
    excludedFeatures: PACKAGE_MARKETING.free.excludedFeatures,
    isFreeTier: true,
  },
  {
    id: "starter",
    name: "Starter",
    description: "Paid bookings, video and AI for solo practices",
    priceMonthlyPence: 19900, // £199
    perUser: false,
    defaultSeats: 1,
    maxSeats: 1, // single seat only — multi-doctor is Clinic
    includedSeats: 1,
    extraSeatPricePence: 0, // no add-on seats — must upgrade
    // Annual = 12-month term; monthly = no lock-in (UI uses billing period)
    commitmentMonths: 12,
    features: PACKAGE_MARKETING.starter.features,
    excludedFeatures: PACKAGE_MARKETING.starter.excludedFeatures,
  },
  {
    id: "professional",
    name: "Professional",
    description: "Solo growth: SMS, analytics, CRM and waitlist",
    priceMonthlyPence: 29900, // £299 flat — one doctor seat (not per-user multi-seat)
    perUser: false,
    defaultSeats: 1,
    maxSeats: 1, // multi-doctor only on Clinic
    includedSeats: 1,
    extraSeatPricePence: 0,
    commitmentMonths: 12,
    features: PACKAGE_MARKETING.professional.features,
    excludedFeatures: PACKAGE_MARKETING.professional.excludedFeatures,
    popular: true,
  },
  {
    id: "clinic",
    // Short card title — full product name still used in Stripe product_data
    name: "Clinic",
    description: "3–15 seats, multi-location and team tools",
    priceMonthlyPence: 89700, // £897 = 3 × £299 (was £1,495 for 5 seats)
    perUser: false,
    defaultSeats: 3,
    maxSeats: 15, // 3 included + extras to 15
    includedSeats: 3,
    extraSeatPricePence: 29900, // £299 per extra seat
    commitmentMonths: 12,
    features: PACKAGE_MARKETING.clinic.features,
    excludedFeatures: PACKAGE_MARKETING.clinic.excludedFeatures,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "Custom solutions for large organisations",
    priceMonthlyPence: 0,
    perUser: false,
    defaultSeats: 999,
    maxSeats: 999,
    includedSeats: 999,
    extraSeatPricePence: 0,
    commitmentMonths: 12,
    features: PACKAGE_MARKETING.enterprise.features,
    excludedFeatures: PACKAGE_MARKETING.enterprise.excludedFeatures,
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
 * Env-backed Stripe Price ID for a licence tier (preferred for production).
 * Returns null when unset; checkout helpers then throw (no create-on-the-fly).
 */
export function getEnvLicensePriceId(tier: string): string | null {
  const map: Record<string, string | undefined> = {
    starter: process.env.STRIPE_PRICE_STARTER,
    professional: process.env.STRIPE_PRICE_PROFESSIONAL,
    clinic: process.env.STRIPE_PRICE_CLINIC,
  };
  const id = map[tier]?.trim();
  if (id && id.startsWith("price_")) return id;
  return null;
}

/**
 * Resolve Stripe Price ID for doctor licence checkout.
 * Production requires STRIPE_PRICE_* env vars — we never create ephemeral
 * Stripe Prices at request time (avoids orphaned catalogue drift).
 *
 * Monthly: STRIPE_PRICE_STARTER | STRIPE_PRICE_PROFESSIONAL | STRIPE_PRICE_CLINIC
 * Annual:  STRIPE_PRICE_<TIER>_ANNUAL (required for annual checkout)
 */
export async function getOrCreateLicensePriceId(
  tier: string,
  _tierConfig: LicenseTierConfig,
  billingPeriod: "monthly" | "annual" = "monthly"
): Promise<string> {
  if (billingPeriod === "monthly") {
    const envId = getEnvLicensePriceId(tier);
    if (envId) return envId;
    throw new Error(
      `Missing Stripe price env for licence tier "${tier}". Set STRIPE_PRICE_${tier.toUpperCase()} (price_…).`
    );
  }

  const annualEnv = process.env[`STRIPE_PRICE_${tier.toUpperCase()}_ANNUAL`];
  if (annualEnv?.startsWith("price_")) return annualEnv;
  throw new Error(
    `Missing Stripe annual price env for licence tier "${tier}". Set STRIPE_PRICE_${tier.toUpperCase()}_ANNUAL (price_…).`
  );
}

/**
 * Medical testing add-on price. Requires STRIPE_PRICE_TESTING_ADDON (monthly)
 * or STRIPE_PRICE_TESTING_ADDON_ANNUAL (annual). No ephemeral create.
 */
export async function getOrCreateTestingAddonPriceId(
  billingPeriod: "monthly" | "annual" = "monthly"
): Promise<string> {
  if (billingPeriod === "monthly") {
    const id = process.env.STRIPE_PRICE_TESTING_ADDON?.trim();
    if (id?.startsWith("price_")) return id;
    throw new Error(
      "Missing STRIPE_PRICE_TESTING_ADDON (price_…). Configure it in env — do not create Prices at runtime."
    );
  }
  const annual = process.env.STRIPE_PRICE_TESTING_ADDON_ANNUAL?.trim();
  if (annual?.startsWith("price_")) return annual;
  throw new Error(
    "Missing STRIPE_PRICE_TESTING_ADDON_ANNUAL (price_…). Configure it in env — do not create Prices at runtime."
  );
}

/**
 * Extra seat price. Requires STRIPE_PRICE_EXTRA_SEAT. No ephemeral create.
 */
export async function getOrCreateExtraSeatPriceId(): Promise<string> {
  const id = process.env.STRIPE_PRICE_EXTRA_SEAT?.trim();
  if (id?.startsWith("price_")) return id;
  throw new Error(
    "Missing STRIPE_PRICE_EXTRA_SEAT (price_…). Configure it in env — do not create Prices at runtime."
  );
}

