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
} from "@/lib/validators/license";
import { getLicenseTier, getModuleConfig, EXTRA_SEAT_PRICE_CENTS } from "@/lib/constants/license-tiers";
import type { LicenseTier } from "@/types";

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

  const { data: license } = await supabase
    .from("licenses")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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

export async function createLicenseCheckout(formData: FormData) {
  const { error: authError, supabase, org } = await requireOrgOwner();
  if (authError || !supabase || !org) return { error: authError };

  const parsed = createLicenseCheckoutSchema.safeParse({
    tier: formData.get("tier") as string,
    billing_period: (formData.get("billing_period") as string) || "monthly",
    coupon_code: (formData.get("coupon_code") as string) || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };

  const tierConfig = getLicenseTier(parsed.data.tier);
  if (!tierConfig) return { error: "Invalid tier" };
  if (tierConfig.isCustomPricing) return { error: "Please contact sales for Enterprise pricing" };

  // Check no existing active license
  const { data: existingLicense } = await supabase
    .from("licenses")
    .select("id")
    .eq("organization_id", org.id)
    .in("status", ["active", "trialing", "past_due"])
    .limit(1)
    .maybeSingle();

  if (existingLicense) return { error: "You already have an active license. Use upgrade instead." };

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

  // Determine price based on tier and billing period
  const currency = org.base_currency?.toLowerCase() || "eur";
  const unitAmount =
    parsed.data.billing_period === "annual"
      ? tierConfig.priceAnnual
      : tierConfig.priceMonthly;

  const interval = parsed.data.billing_period === "annual" ? "year" : "month";

  // Create a price on-the-fly (or use pre-configured Stripe prices)
  const price = await stripe.prices.create({
    currency,
    unit_amount: tierConfig.prices[currency.toUpperCase()] || unitAmount,
    recurring: { interval },
    product_data: {
      name: `MyDoctors360 ${tierConfig.name} License`,
      metadata: { tier: parsed.data.tier },
    },
  });

  const sessionOptions: Record<string, unknown> = {
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: {
      organization_id: org.id,
      tier: parsed.data.tier,
      type: "license",
    },
    subscription_data: {
      metadata: {
        organization_id: org.id,
        tier: parsed.data.tier,
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

export async function addExtraSeats(formData: FormData) {
  const { error: authError, supabase, org } = await requireOrgOwner();
  if (authError || !supabase || !org) return { error: authError };

  const parsed = addExtraSeatsSchema.safeParse({
    count: parseInt(formData.get("count") as string, 10),
  });
  if (!parsed.success) return { error: "Invalid seat count" };

  const { data: license } = await supabase
    .from("licenses")
    .select("*")
    .eq("organization_id", org.id)
    .in("status", ["active", "trialing", "past_due"])
    .limit(1)
    .maybeSingle();

  if (!license) return { error: "No active license found" };

  const tierConfig = getLicenseTier(license.tier);
  if (!tierConfig) return { error: "Invalid license tier" };

  const newTotal = license.used_seats + parsed.data.count;
  const newMaxSeats = license.max_seats + parsed.data.count;

  if (newTotal > tierConfig.maxSeats + 50) {
    return { error: "Exceeds maximum allowed seats for this tier. Consider upgrading." };
  }

  // Update license seats
  const adminSupabase = createAdminClient();
  await adminSupabase
    .from("licenses")
    .update({
      max_seats: newMaxSeats,
      extra_seat_count: license.extra_seat_count + parsed.data.count,
    })
    .eq("id", license.id);

  // If Stripe subscription exists, add/update seat line item
  if (license.stripe_subscription_id) {
    try {
      const stripe = getStripe();
      const subscription = await stripe.subscriptions.retrieve(license.stripe_subscription_id);

      // Create a price for extra seats
      const currency = org.base_currency?.toLowerCase() || "eur";
      const seatPrice = await stripe.prices.create({
        currency,
        unit_amount: EXTRA_SEAT_PRICE_CENTS,
        recurring: { interval: "month" },
        product_data: { name: "Extra Doctor Seat" },
      });

      await stripe.subscriptions.update(license.stripe_subscription_id, {
        items: [
          ...subscription.items.data.map((item) => ({ id: item.id })),
          { price: seatPrice.id, quantity: parsed.data.count },
        ],
      });
    } catch (err) {
      console.error("[License] Failed to update Stripe subscription for extra seats:", err);
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

  const { data: license } = await supabase
    .from("licenses")
    .select("id")
    .eq("organization_id", org.id)
    .in("status", ["active", "trialing", "past_due"])
    .limit(1)
    .maybeSingle();

  if (!license) return { error: "No active license found" };

  const adminSupabase = createAdminClient();

  if (parsed.data.enabled) {
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
