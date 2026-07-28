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
 * Returns null when unset so callers can fall back to create-on-the-fly.
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
 * Monthly: prefers STRIPE_PRICE_* env vars.
 * Annual: 2 months free (10× monthly, billed yearly); env STRIPE_PRICE_*_ANNUAL optional later.
 */
const _cachedLicensePriceIds: Record<string, string> = {};

export async function getOrCreateLicensePriceId(
  tier: string,
  tierConfig: LicenseTierConfig,
  billingPeriod: "monthly" | "annual" = "monthly"
): Promise<string> {
  const { annualTotalPence } = await import(
    "@/lib/constants/billing-period"
  );

  if (billingPeriod === "monthly") {
    const envId = getEnvLicensePriceId(tier);
    if (envId) return envId;
  } else {
    const annualEnv = process.env[`STRIPE_PRICE_${tier.toUpperCase()}_ANNUAL`];
    if (annualEnv?.startsWith("price_")) return annualEnv;
  }

  const cacheKey = `${tier}:${billingPeriod}`;
  if (_cachedLicensePriceIds[cacheKey]) return _cachedLicensePriceIds[cacheKey];

  const { getStripe } = await import("@/lib/stripe/client");
  const stripe = getStripe();
  const unitAmount =
    billingPeriod === "annual"
      ? annualTotalPence(tierConfig.priceMonthlyPence)
      : tierConfig.priceMonthlyPence;
  const interval = billingPeriod === "annual" ? "year" : "month";

  try {
    const existing = await stripe.prices.search({
      query: `metadata["license_tier"]:"${tier}" metadata["billing_period"]:"${billingPeriod}" active:"true"`,
      limit: 1,
    });
    if (existing.data[0]?.id) {
      _cachedLicensePriceIds[cacheKey] = existing.data[0].id;
      return existing.data[0].id;
    }
  } catch {
    /* search may be unavailable — fall through to create */
  }

  // Monthly without billing_period metadata (legacy search)
  if (billingPeriod === "monthly") {
    try {
      const existing = await stripe.prices.search({
        query: `metadata["license_tier"]:"${tier}" active:"true"`,
        limit: 1,
      });
      if (
        existing.data[0]?.id &&
        existing.data[0].recurring?.interval === "month"
      ) {
        _cachedLicensePriceIds[cacheKey] = existing.data[0].id;
        return existing.data[0].id;
      }
    } catch {
      /* fall through */
    }
  }

  const price = await stripe.prices.create({
    currency: "gbp",
    unit_amount: unitAmount,
    recurring: { interval },
    product_data: {
      name: `MyDoctors360 ${tierConfig.name} License${
        billingPeriod === "annual" ? " (Annual — 2 months free)" : ""
      }`,
      metadata: { tier, license_tier: tier, billing_period: billingPeriod },
    },
    metadata: {
      tier,
      license_tier: tier,
      billing_period: billingPeriod,
    },
  });

  _cachedLicensePriceIds[cacheKey] = price.id;
  return price.id;
}

/**
 * Medical testing add-on price. Prefers STRIPE_PRICE_TESTING_ADDON (monthly).
 * Annual = 10× monthly (2 months free).
 */
const _cachedTestingAddonPriceIds: Record<string, string> = {};

export async function getOrCreateTestingAddonPriceId(
  billingPeriod: "monthly" | "annual" = "monthly"
): Promise<string> {
  const { annualTotalPence } = await import(
    "@/lib/constants/billing-period"
  );

  if (
    billingPeriod === "monthly" &&
    process.env.STRIPE_PRICE_TESTING_ADDON?.startsWith("price_")
  ) {
    return process.env.STRIPE_PRICE_TESTING_ADDON;
  }

  if (_cachedTestingAddonPriceIds[billingPeriod]) {
    return _cachedTestingAddonPriceIds[billingPeriod];
  }

  const { getStripe } = await import("@/lib/stripe/client");
  const stripe = getStripe();
  const monthly =
    AVAILABLE_MODULES.find((m) => m.key === "medical_testing")
      ?.priceMonthlyPence ?? 4900;
  const unitAmount =
    billingPeriod === "annual" ? annualTotalPence(monthly) : monthly;
  const interval = billingPeriod === "annual" ? "year" : "month";
  const typeKey =
    billingPeriod === "annual"
      ? "medical_testing_addon_annual"
      : "medical_testing_addon";

  try {
    const existing = await stripe.prices.search({
      query: `metadata["type"]:"${typeKey}" active:"true"`,
      limit: 1,
    });
    if (existing.data[0]?.id) {
      _cachedTestingAddonPriceIds[billingPeriod] = existing.data[0].id;
      return existing.data[0].id;
    }
  } catch {
    /* fall through */
  }

  const price = await stripe.prices.create({
    currency: "gbp",
    unit_amount: unitAmount,
    recurring: { interval },
    product_data: {
      name:
        billingPeriod === "annual"
          ? "Medical Testing Add-on (Annual — 2 months free)"
          : "Medical Testing Add-on",
      metadata: { type: typeKey },
    },
    metadata: { type: typeKey, billing_period: billingPeriod },
  });
  _cachedTestingAddonPriceIds[billingPeriod] = price.id;
  return price.id;
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
