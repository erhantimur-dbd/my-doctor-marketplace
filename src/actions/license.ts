"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { revalidatePath } from "next/cache";
import {
  createLicenseCheckoutSchema,
  addExtraSeatsSchema,
  toggleModuleSchema,
  upgradeTierSchema,
  schedulePlanChangeSchema,
} from "@/lib/validators/license";
import { getLicenseTier, getModuleConfig, EXTRA_SEAT_PRICE_PENCE, convertPrice, BASE_CURRENCY, getOrCreateExtraSeatPriceId } from "@/lib/constants/license-tiers";
import type { LicenseTier } from "@/types";
import { log } from "@/lib/utils/logger";

// ─── Helpers ────────────────────────────────────────────────

async function requireOrgOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", supabase: null, org: null, membership: null };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("*, organization:organizations(*)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) return { error: "Not a member of any organization", supabase: null, org: null, membership: null };
  if (membership.role !== "owner") return { error: "Only the organization owner can manage billing", supabase: null, org: null, membership: null };

  const org: any = Array.isArray(membership.organization)
    ? membership.organization[0]
    : membership.organization;

  return { error: null, supabase, org, membership };
}

// ─── Read Actions ───────────────────────────────────────────

export async function getOrganizationLicense() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", license: null, modules: null };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) return { error: null, license: null, modules: null };

  const { data: licenses } = await supabase
    .from("licenses")
    .select("*")
    .eq("organization_id", membership.organization_id);

  const { pickEffectiveLicense } = await import("@/lib/license/tier-lifecycle");
  const license = pickEffectiveLicense(licenses || []);

  if (!license) return { error: null, license: null, modules: null };

  const { data: modules } = await supabase
    .from("license_modules")
    .select("*")
    .eq("license_id", license.id)
    .eq("is_active", true);

  return { error: null, license, modules: modules || [] };
}

/**
 * Check the effective license status for the current user's org.
 * Light-weight check for enforcement in actions and middleware.
 */
export async function checkLicenseStatus() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: null };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) return { status: null };

  const { data: license } = await supabase
    .from("licenses")
    .select("status")
    .eq("organization_id", membership.organization_id)
    .in("status", ["active", "trialing", "past_due", "grace_period", "suspended"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { status: license?.status || null };
}

// ─── Billing Actions ────────────────────────────────────────

type LicenseCheckoutResult = {
  error?: string | null;
  url?: string | null;
  upgraded?: boolean;
  tier?: string;
};

export async function createLicenseCheckout(
  formData: FormData
): Promise<LicenseCheckoutResult> {
  const { error: authError, supabase, org } = await requireOrgOwner();
  if (authError || !supabase || !org) return { error: authError };

  const parsed = createLicenseCheckoutSchema.safeParse({
    tier: formData.get("tier") as string,
    billing_period: (formData.get("billing_period") as string) || "monthly",
    seat_count: formData.get("seat_count") ? parseInt(formData.get("seat_count") as string, 10) : undefined,
    coupon_code: (formData.get("coupon_code") as string) || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };

  const tierConfig = getLicenseTier(parsed.data.tier);
  if (!tierConfig) return { error: "Invalid tier" };
  if (tierConfig.isCustomPricing) return { error: "Please get in touch for Enterprise pricing" };
  if (tierConfig.isFreeTier) return { error: "Free tier does not require checkout" };

  // Free gateway may already have an active free row — that must not block Starter Checkout.
  // Paid→paid upgrades use upgradeLicenseTier (Stripe subscription update).
  const { data: existingRows } = await supabase
    .from("licenses")
    .select("id, tier, status, stripe_subscription_id, created_at")
    .eq("organization_id", org.id);

  const {
    resolvePaidCheckoutMode,
  } = await import("@/lib/license/tier-lifecycle");
  const decision = resolvePaidCheckoutMode(
    existingRows || [],
    parsed.data.tier
  );

  if (decision.mode === "blocked") {
    return { error: decision.reason || "Cannot start checkout for this plan" };
  }
  if (decision.mode === "upgrade_paid") {
    // Delegate to subscription update path
    const upgradeFd = new FormData();
    upgradeFd.set("new_tier", parsed.data.tier);
    upgradeFd.set(
      "billing_period",
      (formData.get("billing_period") as string) || "monthly"
    );
    if (formData.get("seat_count")) {
      upgradeFd.set("seat_count", formData.get("seat_count") as string);
    }
    return upgradeLicenseTier(upgradeFd);
  }

  const stripe = getStripe();

  // Get or create Stripe customer for the org
  let customerId = org.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: org.email || undefined,
      name: org.name,
      metadata: { organization_id: org.id },
    });
    customerId = customer.id;

    const adminSupabase = createAdminClient();
    await adminSupabase
      .from("organizations")
      .update({ stripe_customer_id: customerId })
      .eq("id", org.id);
  }

  const billingPeriod =
    parsed.data.billing_period === "annual" ? "annual" : "monthly";

  // Prefer env-backed Stripe Price IDs (same path as registerDoctorWithCheckout)
  const { getOrCreateLicensePriceId } = await import(
    "@/lib/constants/license-tiers"
  );
  const priceId = await getOrCreateLicensePriceId(
    parsed.data.tier,
    tierConfig,
    billingPeriod
  );

  // Per-user pricing: Professional tier quantity = seat count
  const seatCount = parsed.data.seat_count || 1;
  const quantity = tierConfig.perUser
    ? Math.min(seatCount, tierConfig.maxSeats)
    : 1;
  const maxSeats = tierConfig.perUser
    ? quantity
    : tierConfig.includedSeats || 1;

  const sessionOptions: Record<string, unknown> = {
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity }],
    metadata: {
      organization_id: org.id,
      tier: parsed.data.tier,
      type: "license",
      billing_period: billingPeriod,
    },
    subscription_data: {
      metadata: {
        organization_id: org.id,
        tier: parsed.data.tier,
        type: "license",
        seat_count: String(quantity),
        max_seats: String(maxSeats),
        billing_period: billingPeriod,
      },
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/en/doctor-dashboard/organization/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/en/doctor-dashboard/organization/billing`,
  };

  // Apply coupon if provided
  if (parsed.data.coupon_code) {
    try {
      const coupon = await stripe.coupons.retrieve(parsed.data.coupon_code);
      if (coupon && coupon.valid) {
        (sessionOptions as any).discounts = [{ coupon: coupon.id }];
      }
    } catch {
      // Invalid coupon — continue without discount
    }
  }

  const session = await stripe.checkout.sessions.create(
    sessionOptions as any
  );

  return { url: session.url };
}

/**
 * @deprecated Professional is a single-doctor flat plan.
 * Multi-doctor seats are Clinic (3–15) via addExtraSeats.
 */
export async function setProfessionalSeatCapacity(_formData: FormData): Promise<{
  error?: string | null;
  maxSeats?: number;
}> {
  void _formData;
  return {
    error:
      "Professional includes one doctor seat. For 3–15 doctors on one bill, upgrade to Clinic from Billing.",
  };
}

export async function manageLicenseBilling() {
  const { error: authError, supabase, org } = await requireOrgOwner();
  if (authError || !supabase || !org) return { error: authError };

  if (!org.stripe_customer_id) return { error: "No billing account found. Please subscribe first." };

  const stripe = getStripe();

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/en/doctor-dashboard/organization/billing`,
  });

  return { url: portalSession.url };
}

/**
 * Preview the cost impact of adding extra seats — read-only, no mutations.
 * Used by the billing UI to show a confirmation dialog before committing.
 */
export async function previewSeatCost(count: number) {
  const { error: authError, supabase, org } = await requireOrgOwner();
  if (authError || !supabase || !org) return { error: authError };

  if (!count || count < 1 || count > 50) return { error: "Invalid seat count" };

  const { data: licenseRows } = await supabase
    .from("licenses")
    .select("*")
    .eq("organization_id", org.id)
    .in("status", ["active", "trialing", "past_due"]);

  const { pickEffectiveLicense, isPaidTier } = await import(
    "@/lib/license/tier-lifecycle"
  );
  const license = pickEffectiveLicense(licenseRows || []);

  if (!license || !isPaidTier(license.tier)) {
    return { error: "No active paid license found" };
  }

  const tierConfig = getLicenseTier(license.tier);
  if (!tierConfig) return { error: "Invalid license tier" };

  // Calculate costs
  const currentPlanPence = tierConfig.perUser
    ? tierConfig.priceMonthlyPence * license.max_seats
    : tierConfig.priceMonthlyPence;
  const existingExtraPence = license.extra_seat_count * EXTRA_SEAT_PRICE_PENCE;
  const currentMonthlyPence = currentPlanPence + existingExtraPence;

  const newExtraPence = count * EXTRA_SEAT_PRICE_PENCE;
  const newMonthlyPence = currentMonthlyPence + newExtraPence;

  // Calculate prorated amount for remaining days
  const now = new Date();
  const periodEnd = new Date(license.current_period_end);
  const periodStart = new Date(license.current_period_start);
  const totalDays = Math.max(1, (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.max(0, (periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const proratedPence = Math.round((newExtraPence * remainingDays) / totalDays);

  return {
    currentPlanName: tierConfig.name,
    currentSeats: license.max_seats,
    existingExtraSeats: license.extra_seat_count,
    extraSeatsRequested: count,
    newTotalSeats: license.max_seats + count,
    seatPricePence: EXTRA_SEAT_PRICE_PENCE,
    currentMonthlyPence,
    extraCostPence: newExtraPence,
    newMonthlyPence,
    proratedPence,
    remainingDays: Math.round(remainingDays),
    nextBillingDate: periodEnd.toISOString().split("T")[0],
    currency: "GBP",
  };
}

export async function addExtraSeats(formData: FormData) {
  const { error: authError, supabase, org } = await requireOrgOwner();
  if (authError || !supabase || !org) return { error: authError };

  const parsed = addExtraSeatsSchema.safeParse({
    count: parseInt(formData.get("count") as string, 10),
  });
  if (!parsed.success) return { error: "Invalid seat count" };

  const { data: licenseRows } = await supabase
    .from("licenses")
    .select("*")
    .eq("organization_id", org.id)
    .in("status", ["active", "trialing", "past_due"]);

  const { pickEffectiveLicense, isPaidTier } = await import(
    "@/lib/license/tier-lifecycle"
  );
  const license = pickEffectiveLicense(licenseRows || []);

  if (!license || !isPaidTier(license.tier)) {
    return { error: "No active paid license found" };
  }

  const tierConfig = getLicenseTier(license.tier);
  if (!tierConfig) return { error: "Invalid license tier" };

  // Check if this tier supports extra seats
  if (tierConfig.extraSeatPricePence <= 0 || tierConfig.isFreeTier) {
    return { error: "Extra seats are not available on this plan. Please upgrade." };
  }

  const newExtraCount = license.extra_seat_count + parsed.data.count;
  const newMaxSeats = license.max_seats + parsed.data.count;

  // Enforce tier cap (e.g. Starter max 4, Professional max 4, Clinic max 15)
  if (newMaxSeats > tierConfig.maxSeats) {
    const availableToAdd = tierConfig.maxSeats - license.max_seats;
    if (availableToAdd <= 0) {
      return { error: `You've reached the maximum of ${tierConfig.maxSeats} seats for the ${tierConfig.name} plan. Consider upgrading.` };
    }
    return { error: `You can add up to ${availableToAdd} more seat(s) on the ${tierConfig.name} plan (max ${tierConfig.maxSeats}).` };
  }

  // Update license seats in DB
  const adminSupabase = createAdminClient();
  await adminSupabase
    .from("licenses")
    .update({
      max_seats: newMaxSeats,
      extra_seat_count: newExtraCount,
    })
    .eq("id", license.id);

  // Sync to Stripe — use reusable price, update quantity on existing item
  if (license.stripe_subscription_id) {
    try {
      const stripe = getStripe();
      const seatPriceId = await getOrCreateExtraSeatPriceId();
      const subscription = await stripe.subscriptions.retrieve(license.stripe_subscription_id);

      // Find existing extra-seat subscription item
      const existingItem = subscription.items.data.find(
        (item) => item.price.metadata?.type === "extra_seat"
      );

      if (existingItem) {
        // Update quantity on existing line item
        await stripe.subscriptionItems.update(existingItem.id, {
          quantity: newExtraCount,
          proration_behavior: "create_prorations",
        });
      } else {
        // Add new line item for extra seats
        await stripe.subscriptions.update(license.stripe_subscription_id, {
          items: [
            ...subscription.items.data.map((item) => ({ id: item.id })),
            { price: seatPriceId, quantity: parsed.data.count },
          ],
          proration_behavior: "create_prorations",
        });
      }
    } catch (err) {
      log.error("[License] Failed to update Stripe subscription for extra seats:", { err });
    }
  }

  revalidatePath("/doctor-dashboard/organization/billing");
  return { error: null };
}

export async function toggleModule(formData: FormData) {
  const { error: authError, supabase, org } = await requireOrgOwner();
  if (authError || !supabase || !org) return { error: authError };

  const parsed = toggleModuleSchema.safeParse({
    module_key: formData.get("module_key") as string,
    enabled: formData.get("enabled") === "true",
  });
  if (!parsed.success) return { error: "Invalid input" };

  const moduleConfig = getModuleConfig(parsed.data.module_key);
  if (!moduleConfig) return { error: "Unknown module" };

  const { data: licenses } = await supabase
    .from("licenses")
    .select("id, tier, status, stripe_subscription_id")
    .eq("organization_id", org.id);

  const { pickEffectiveLicense } = await import("@/lib/license/tier-lifecycle");
  const license = pickEffectiveLicense(licenses || []);
  if (!license) return { error: "No active license found" };

  const adminSupabase = createAdminClient();
  const enabled = parsed.data.enabled;

  // Medical Testing: keep doctors.has_testing_addon in sync; charge Stripe for
  // Starter/Pro paid add-on; Clinic/Enterprise include at no extra fee.
  if (parsed.data.module_key === "medical_testing") {
    const {
      canToggleMedicalTestingModule,
      isTestingAddonPriceMetadata,
    } = await import("@/lib/license/medical-testing");
    const gate = canToggleMedicalTestingModule(license.tier);
    if (!gate.ok) return { error: gate.reason };

    if (enabled && gate.mode === "paid_addon") {
      if (!license.stripe_subscription_id) {
        return {
          error:
            "No Stripe subscription found. Complete licence checkout before adding Medical Testing.",
        };
      }
      try {
        const stripe = getStripe();
        const {
          getOrCreateTestingAddonPriceId,
        } = await import("@/lib/constants/license-tiers");
        const sub = await stripe.subscriptions.retrieve(
          license.stripe_subscription_id,
          { expand: ["items.data.price"] }
        );
        const billingPeriod =
          sub.items?.data?.[0]?.price?.recurring?.interval === "year"
            ? "annual"
            : "monthly";
        const testingPriceId =
          await getOrCreateTestingAddonPriceId(billingPeriod);
        const monthlyId = await getOrCreateTestingAddonPriceId("monthly");
        const annualId = await getOrCreateTestingAddonPriceId("annual");
        const already = (sub.items?.data || []).some((item) => {
          const priceId =
            typeof item.price === "string" ? item.price : item.price?.id;
          if (priceId === testingPriceId || priceId === monthlyId || priceId === annualId) {
            return true;
          }
          const meta = (
            typeof item.price === "object" ? item.price?.metadata : undefined
          ) as Record<string, string> | undefined;
          return isTestingAddonPriceMetadata(meta);
        });
        if (!already) {
          await stripe.subscriptionItems.create({
            subscription: license.stripe_subscription_id,
            price: testingPriceId,
            quantity: 1,
            proration_behavior: "create_prorations",
          });
        }
      } catch (err) {
        log.error("[License] Failed to add Medical Testing Stripe item:", {
          err,
        });
        return {
          error:
            "Could not update billing for Medical Testing. Please try again or contact support.",
        };
      }
    }

    if (!enabled && gate.mode === "paid_addon" && license.stripe_subscription_id) {
      try {
        const stripe = getStripe();
        const {
          getOrCreateTestingAddonPriceId,
        } = await import("@/lib/constants/license-tiers");
        const monthlyId = await getOrCreateTestingAddonPriceId("monthly");
        const annualId = await getOrCreateTestingAddonPriceId("annual");
        const sub = await stripe.subscriptions.retrieve(
          license.stripe_subscription_id,
          { expand: ["items.data.price"] }
        );
        for (const item of sub.items?.data || []) {
          const priceId =
            typeof item.price === "string" ? item.price : item.price?.id;
          const meta = (
            typeof item.price === "object" ? item.price?.metadata : undefined
          ) as Record<string, string> | undefined;
          const isTesting =
            priceId === monthlyId ||
            priceId === annualId ||
            isTestingAddonPriceMetadata(meta);
          if (isTesting) {
            await stripe.subscriptionItems.del(item.id, {
              proration_behavior: "create_prorations",
            });
          }
        }
      } catch (err) {
        log.error("[License] Failed to remove Medical Testing Stripe item:", {
          err,
        });
        return {
          error:
            "Could not remove Medical Testing from billing. Please try again or contact support.",
        };
      }
    }

    await adminSupabase
      .from("doctors")
      .update({ has_testing_addon: enabled })
      .eq("organization_id", org.id);

    if (enabled) {
      await adminSupabase.from("license_modules").upsert(
        {
          license_id: license.id,
          module_key: "medical_testing",
          is_active: true,
          activated_at: new Date().toISOString(),
          deactivated_at: null,
        },
        { onConflict: "license_id,module_key" }
      );
    } else {
      await adminSupabase
        .from("license_modules")
        .update({
          is_active: false,
          deactivated_at: new Date().toISOString(),
        })
        .eq("license_id", license.id)
        .eq("module_key", "medical_testing");
    }

    revalidatePath("/doctor-dashboard/organization/billing");
    revalidatePath("/doctor-dashboard/medical-testing");
    return { error: null };
  }

  // Other modules: license_modules only (legacy)
  if (enabled) {
    await adminSupabase.from("license_modules").upsert(
      {
        license_id: license.id,
        module_key: parsed.data.module_key,
        is_active: true,
        activated_at: new Date().toISOString(),
        deactivated_at: null,
      },
      { onConflict: "license_id,module_key" }
    );
  } else {
    await adminSupabase
      .from("license_modules")
      .update({
        is_active: false,
        deactivated_at: new Date().toISOString(),
      })
      .eq("license_id", license.id)
      .eq("module_key", parsed.data.module_key);
  }

  revalidatePath("/doctor-dashboard/organization/billing");
  return { error: null };
}

/**
 * Upgrade package: free→paid uses Checkout; paid→higher (starter→professional)
 * updates the Stripe subscription price and local licence tier.
 */
export async function upgradeLicenseTier(
  formData: FormData
): Promise<LicenseCheckoutResult> {
  const { error: authError, supabase, org } = await requireOrgOwner();
  if (authError || !supabase || !org) return { error: authError };

  const newTier =
    (formData.get("new_tier") as string) || (formData.get("tier") as string);
  const parsed = upgradeTierSchema.safeParse({ new_tier: newTier });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid tier" };
  }

  const tierConfig = getLicenseTier(parsed.data.new_tier);
  if (!tierConfig || tierConfig.isFreeTier || tierConfig.isCustomPricing) {
    return { error: "Invalid upgrade target" };
  }

  const { data: existingRows } = await supabase
    .from("licenses")
    .select("id, tier, status, stripe_subscription_id, created_at, max_seats")
    .eq("organization_id", org.id);

  const { resolvePaidCheckoutMode } = await import(
    "@/lib/license/tier-lifecycle"
  );
  const decision = resolvePaidCheckoutMode(
    existingRows || [],
    parsed.data.new_tier
  );

  if (decision.mode === "blocked") {
    return { error: decision.reason || "Upgrade not available" };
  }

  // free→paid or no licence: Checkout session (createLicenseCheckout allows free row)
  if (decision.mode === "new" || decision.mode === "upgrade_from_free") {
    const checkoutFd = new FormData();
    checkoutFd.set("tier", parsed.data.new_tier);
    checkoutFd.set(
      "billing_period",
      (formData.get("billing_period") as string) || "monthly"
    );
    if (formData.get("seat_count")) {
      checkoutFd.set("seat_count", formData.get("seat_count") as string);
    }
    if (formData.get("coupon_code")) {
      checkoutFd.set("coupon_code", formData.get("coupon_code") as string);
    }
    return createLicenseCheckout(checkoutFd);
  }

  const current = decision.current;
  if (!current?.stripe_subscription_id) {
    return {
      error:
        "No Stripe subscription found for your plan. Use Manage Billing or contact support.",
    };
  }

  const billingPeriod =
    (formData.get("billing_period") as string) === "annual"
      ? "annual"
      : "monthly";
  const seatCount = formData.get("seat_count")
    ? parseInt(formData.get("seat_count") as string, 10)
    : 1;

  const { getOrCreateLicensePriceId } = await import(
    "@/lib/constants/license-tiers"
  );
  const priceId = await getOrCreateLicensePriceId(
    parsed.data.new_tier,
    tierConfig,
    billingPeriod
  );

  const quantity = tierConfig.perUser
    ? Math.min(Math.max(seatCount, 1), tierConfig.maxSeats)
    : 1;
  const maxSeats = tierConfig.perUser
    ? quantity
    : tierConfig.includedSeats || 1;

  const stripe = getStripe();
  try {
    const subscription = await stripe.subscriptions.retrieve(
      current.stripe_subscription_id
    );
    const itemId = subscription.items.data[0]?.id;
    if (!itemId) {
      return { error: "Subscription has no line items to upgrade" };
    }

    await stripe.subscriptions.update(current.stripe_subscription_id, {
      items: [{ id: itemId, price: priceId, quantity }],
      proration_behavior: "create_prorations",
      metadata: {
        ...subscription.metadata,
        organization_id: org.id,
        tier: parsed.data.new_tier,
        type: "license",
        seat_count: String(quantity),
        max_seats: String(maxSeats),
        billing_period: billingPeriod,
      },
    });

    if (current.id) {
      await supabase
        .from("licenses")
        .update({
          tier: parsed.data.new_tier,
          max_seats: maxSeats,
          used_seats: Math.min(quantity, maxSeats),
        })
        .eq("id", current.id);
    }

    revalidatePath("/doctor-dashboard/organization/billing");
    return { error: null, upgraded: true as const, tier: parsed.data.new_tier };
  } catch (err) {
    log.error("upgradeLicenseTier failed", { err });
    return {
      error:
        err instanceof Error
          ? err.message
          : "Failed to upgrade subscription. Try Manage Billing.",
    };
  }
}

type SchedulePlanResult = {
  error?: string | null;
  scheduled?: boolean;
  upgraded?: boolean;
  url?: string | null;
  targetTier?: string;
  periodEnd?: string | null;
  message?: string;
};

/**
 * Self-service plan change:
 * - upgrade → immediate Checkout / subscription update
 * - downgrade / cancel to free → schedule at period end (no refunds)
 */
export async function schedulePlanChange(
  formData: FormData
): Promise<SchedulePlanResult> {
  const { error: authError, supabase, org } = await requireOrgOwner();
  if (authError || !supabase || !org) return { error: authError };

  const parsed = schedulePlanChangeSchema.safeParse({
    target_tier:
      (formData.get("target_tier") as string) ||
      (formData.get("tier") as string) ||
      (formData.get("new_tier") as string),
    billing_period: (formData.get("billing_period") as string) || undefined,
    seat_count: formData.get("seat_count")
      ? parseInt(formData.get("seat_count") as string, 10)
      : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid plan change" };
  }

  const { data: existingRows } = await supabase
    .from("licenses")
    .select(
      "id, tier, status, stripe_subscription_id, created_at, cancel_at_period_end, current_period_end, metadata"
    )
    .eq("organization_id", org.id);

  const {
    resolvePlanChange,
    PENDING_TIER_META,
    PENDING_CHANGE_META,
  } = await import("@/lib/license/tier-lifecycle");

  const decision = resolvePlanChange(
    existingRows || [],
    parsed.data.target_tier
  );

  if (decision.mode === "blocked" || decision.mode === "already_on_plan") {
    return { error: decision.reason || "Cannot change plan" };
  }

  // Upgrades: immediate
  if (decision.mode === "upgrade_now") {
    if (parsed.data.target_tier === "free") {
      return { error: "Invalid upgrade target" };
    }
    const fd = new FormData();
    fd.set("tier", parsed.data.target_tier);
    fd.set("new_tier", parsed.data.target_tier);
    fd.set(
      "billing_period",
      parsed.data.billing_period || "monthly"
    );
    if (parsed.data.seat_count) {
      fd.set("seat_count", String(parsed.data.seat_count));
    }
    const result = await createLicenseCheckout(fd);
    if (result.error) return { error: result.error };
    if (result.url) return { url: result.url, upgraded: true };
    if (result.upgraded) {
      return {
        upgraded: true,
        targetTier: parsed.data.target_tier,
        message: `Upgraded to ${parsed.data.target_tier}.`,
      };
    }
    return result;
  }

  // Downgrades: schedule only
  const current = decision.current;
  if (!current?.stripe_subscription_id || !current.id) {
    return {
      error: "No paid Stripe subscription found to schedule a change on.",
    };
  }

  const stripe = getStripe();
  const periodEnd = current.current_period_end || null;

  try {
    if (parsed.data.target_tier === "free") {
      // Cancel at period end — no refund; keep paid features until then
      const sub = await stripe.subscriptions.update(
        current.stripe_subscription_id,
        {
          cancel_at_period_end: true,
          metadata: {
            pending_tier: "free",
            pending_change: "downgrade",
          },
        }
      );

      const existingMeta =
        (current.metadata as Record<string, unknown> | null) || {};
      await supabase
        .from("licenses")
        .update({
          cancel_at_period_end: true,
          metadata: {
            ...existingMeta,
            [PENDING_TIER_META]: "free",
            [PENDING_CHANGE_META]: "downgrade",
          },
        })
        .eq("id", current.id);

      const subPeriodEnd = (sub as unknown as { current_period_end?: number })
        .current_period_end;
      const endIso =
        periodEnd ||
        (subPeriodEnd ? new Date(subPeriodEnd * 1000).toISOString() : null);

      revalidatePath("/doctor-dashboard/organization/billing");
      return {
        scheduled: true,
        targetTier: "free",
        periodEnd: endIso,
        message:
          "Your plan will switch to Founding Free at the end of the current paid period. No refund for the remaining time — you keep paid features until then.",
      };
    }

    // Paid → lower paid: schedule via metadata; apply price at period end (no proration)
    const sub = await stripe.subscriptions.retrieve(
      current.stripe_subscription_id
    );
    await stripe.subscriptions.update(current.stripe_subscription_id, {
      cancel_at_period_end: false,
      metadata: {
        ...sub.metadata,
        organization_id: org.id,
        tier: current.tier, // stay on current tier until apply
        pending_tier: parsed.data.target_tier,
        pending_change: "downgrade",
        type: "license",
      },
    });

    const existingMeta =
      (current.metadata as Record<string, unknown> | null) || {};
    await supabase
      .from("licenses")
      .update({
        cancel_at_period_end: false,
        metadata: {
          ...existingMeta,
          [PENDING_TIER_META]: parsed.data.target_tier,
          [PENDING_CHANGE_META]: "downgrade",
        },
      })
      .eq("id", current.id);

    revalidatePath("/doctor-dashboard/organization/billing");
    return {
      scheduled: true,
      targetTier: parsed.data.target_tier,
      periodEnd,
      message: `Your plan will change to ${parsed.data.target_tier} at the end of the current paid period. No refund — you keep current features until then.`,
    };
  } catch (err) {
    log.error("schedulePlanChange failed", { err });
    return {
      error:
        err instanceof Error
          ? err.message
          : "Failed to schedule plan change. Try Manage Billing.",
    };
  }
}

/** Undo scheduled downgrade / cancel-at-period-end (keep current paid plan). */
export async function cancelScheduledPlanChange(): Promise<{
  error?: string | null;
  resumed?: boolean;
  message?: string;
}> {
  const { error: authError, supabase, org } = await requireOrgOwner();
  if (authError || !supabase || !org) return { error: authError };

  const { data: rows } = await supabase
    .from("licenses")
    .select(
      "id, tier, status, stripe_subscription_id, cancel_at_period_end, metadata"
    )
    .eq("organization_id", org.id);

  const { pickEffectiveLicense, isPaidTier, PENDING_TIER_META, PENDING_CHANGE_META } =
    await import("@/lib/license/tier-lifecycle");
  const current = pickEffectiveLicense(rows || []);
  if (!current || !isPaidTier(current.tier) || !current.stripe_subscription_id) {
    return { error: "No paid plan with a scheduled change found." };
  }

  const stripe = getStripe();
  try {
    const sub = await stripe.subscriptions.retrieve(
      current.stripe_subscription_id
    );
    const meta = { ...sub.metadata };
    delete meta.pending_tier;
    delete meta.pending_change;

    await stripe.subscriptions.update(current.stripe_subscription_id, {
      cancel_at_period_end: false,
      metadata: meta,
    });

    const localMeta = {
      ...((current.metadata as Record<string, unknown>) || {}),
    };
    delete localMeta[PENDING_TIER_META];
    delete localMeta[PENDING_CHANGE_META];

    if (current.id) {
      await supabase
        .from("licenses")
        .update({
          cancel_at_period_end: false,
          metadata: localMeta,
        })
        .eq("id", current.id);
    }

    revalidatePath("/doctor-dashboard/organization/billing");
    return {
      resumed: true,
      message: "Scheduled plan change cancelled. Your current plan continues.",
    };
  } catch (err) {
    log.error("cancelScheduledPlanChange failed", { err });
    return {
      error:
        err instanceof Error
          ? err.message
          : "Could not resume plan. Try Manage Billing.",
    };
  }
}
