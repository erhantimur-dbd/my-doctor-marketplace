import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLicenseTier } from "@/lib/constants/license-tiers";
import { SPECIALTIES } from "@/lib/constants/specialties";
import { formatSpecialtyName } from "@/lib/utils";
import { log } from "@/lib/utils/logger";
import { buildOfferCheckoutFields } from "@/lib/offers/checkout";
import {
  annualDisplayPence,
  envAnnualPriceId,
  resolveLatestAnnualPrice,
} from "@/lib/offers/current-price";
import { renderOfferCopy } from "@/lib/offers/template";
import {
  LICENCE_CHECK_ERROR,
  liveLicenceBlocksCheckout,
  offerConflictsWithFoundingFree,
  validateOfferForCheckout,
} from "@/lib/offers/validation";
import { annualPlanIdForTier, PLAN_LABEL, type AnnualPlanId } from "@/lib/offers/plans";
import { toCheckoutOffer, type OfferRow } from "@/lib/offers/rows";
import {
  attributionClaimOutcome,
  runCheckoutAfterAttributionClaim,
} from "@/lib/offers/attribution-claim";
import { assertStripeTestMode } from "@/lib/offers/stripe-mode";

export type OfferPreview = {
  token: string;
  email: string;
  specialtySlug: string;
  specialtyLabel: string;
  offerId: string;
  offerName: string;
  plans: { id: AnnualPlanId; label: string }[];
  copy: ReturnType<typeof renderOfferCopy>;
};

type InviteBundle = {
  inviteId: string;
  token: string;
  email: string;
  specialtySlug: string;
  offer: ReturnType<typeof toCheckoutOffer>;
  offerName: string;
  usedAt: string | null;
};

function specialtyLabel(slug: string): string {
  const meta = SPECIALTIES.find((item) => item.slug === slug);
  return meta ? formatSpecialtyName(meta.nameKey) : slug;
}

async function loadInvite(token: string): Promise<InviteBundle | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("subscription_offer_invites")
    .select(
      "id, token, doctor_email, specialty_slug, used_at, offer:subscription_offers(*)"
    )
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  const offer = data.offer as OfferRow | OfferRow[] | null;
  const row = Array.isArray(offer) ? offer[0] : offer;
  if (!row) return null;
  return {
    inviteId: data.id,
    token: data.token,
    email: data.doctor_email,
    specialtySlug: data.specialty_slug,
    offer: toCheckoutOffer(row),
    offerName: row.name,
    usedAt: (data.used_at as string | null) ?? null,
  };
}

export async function getOfferSignupPreview(
  token: string | null | undefined
): Promise<OfferPreview | null> {
  if (!token) return null;
  const invite = await loadInvite(token);
  if (!invite || !invite.offer.active) return null;
  if (invite.offer.redeemBy.getTime() <= Date.now()) return null;
  const prices = await annualDisplayPence();
  const copy = renderOfferCopy({
    kind: invite.offer.kind,
    percentOff: invite.offer.percentOff,
    trialDays: invite.offer.trialDays,
    redeemBy: invite.offer.redeemBy,
    trialStartsAt: new Date(),
    soloFullPence: prices.solo,
    proFullPence: prices.pro,
  });
  return {
    token: invite.token,
    email: invite.email,
    specialtySlug: invite.specialtySlug,
    specialtyLabel: specialtyLabel(invite.specialtySlug),
    offerId: invite.offer.id,
    offerName: invite.offerName,
    plans: invite.offer.eligiblePlans.map((id) => ({
      id,
      label: PLAN_LABEL[id],
    })),
    copy,
  };
}

async function licencesForOrganization(
  organizationId: string
): Promise<{ statuses: Array<{ status?: string | null }>; error: boolean }> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("licenses")
    .select("status")
    .eq("organization_id", organizationId);
  if (error) return { statuses: [], error: true };
  return { statuses: data || [], error: false };
}

async function existingOfferIdForEmail(
  email: string,
  incomingOfferId: string
): Promise<{
  foundingFree: boolean;
  existingOfferId: string | null;
  organizationId: string | null;
  doctorId: string | null;
  liveLicenceError: string | null;
}> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (!profile) {
    return {
      foundingFree: false,
      existingOfferId: null,
      organizationId: null,
      doctorId: null,
      liveLicenceError: null,
    };
  }
  const { data: doctor } = await admin
    .from("doctors")
    .select("id, organization_id, is_founding_member")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (!doctor) {
    return {
      foundingFree: false,
      existingOfferId: null,
      organizationId: null,
      doctorId: null,
      liveLicenceError: null,
    };
  }
  let existingOfferId: string | null = null;
  let licenseTier: string | null = null;
  let liveLicenceError: string | null = null;
  if (doctor.organization_id) {
    const { data: licenses, error: licenseError } = await admin
      .from("licenses")
      .select("offer_id, tier, status")
      .eq("organization_id", doctor.organization_id);
    if (licenseError) {
      liveLicenceError = LICENCE_CHECK_ERROR;
    } else {
      liveLicenceError = liveLicenceBlocksCheckout(licenses || []);
      for (const license of licenses || []) {
        if (license.tier === "free" && license.status !== "cancelled") {
          licenseTier = "free";
        }
        if (license.offer_id) existingOfferId = license.offer_id;
      }
    }
  }
  const { data: attribution } = await admin
    .from("subscription_offer_attributions")
    .select("offer_id, status")
    .eq("doctor_id", doctor.id)
    .maybeSingle();
  if (attribution?.offer_id && attribution.offer_id !== incomingOfferId) {
    existingOfferId = attribution.offer_id;
  }
  if (attribution?.status === "subscribed" && attribution.offer_id) {
    existingOfferId = attribution.offer_id;
  }
  return {
    foundingFree: offerConflictsWithFoundingFree({
      tier: "starter",
      foundingMember: Boolean(doctor.is_founding_member),
      licenseTier,
    }),
    existingOfferId,
    organizationId: doctor.organization_id,
    doctorId: doctor.id,
    liveLicenceError,
  };
}

export async function assertOfferCheckoutAllowed(input: {
  email: string;
  planId: string;
  offer: ReturnType<typeof toCheckoutOffer>;
  extraPromotionCode: string | null;
  organizationId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const prior = await existingOfferIdForEmail(input.email, input.offer.id);
  const result = validateOfferForCheckout({
    offer: input.offer,
    planId: input.planId,
    now: new Date(),
    foundingFree: prior.foundingFree,
    existingOfferId: prior.existingOfferId,
    extraPromotionCode: input.extraPromotionCode,
  });
  if (!result.ok) return { ok: false, error: result.error };

  // Before any attribution claim or Stripe call. Covers a paying monthly or
  // annual licence that has no offer_id, which the offer-only unique index
  // does not cover.
  if (prior.liveLicenceError) return { ok: false, error: prior.liveLicenceError };
  const orgId = input.organizationId;
  if (orgId && orgId !== prior.organizationId) {
    const extra = await licencesForOrganization(orgId);
    if (extra.error) return { ok: false, error: LICENCE_CHECK_ERROR };
    const block = liveLicenceBlocksCheckout(extra.statuses);
    if (block) return { ok: false, error: block };
  }
  return { ok: true };
}

async function priceIdForPlan(planId: AnnualPlanId): Promise<string> {
  assertStripeTestMode();
  const tier = planId === "starter_annual" ? "starter" : "professional";
  const catalog = await resolveLatestAnnualPrice(tier);
  if (catalog?.stripePriceId) return catalog.stripePriceId;
  const envId = envAnnualPriceId(planId);
  if (envId) return envId;
  throw new Error(
    `Stripe price setup: set STRIPE_PRICE_${tier.toUpperCase()}_ANNUAL or run scripts/seed-subscription-offers.ts.`
  );
}

export async function createOfferCheckoutSession(input: {
  stripe: Stripe;
  origin: string;
  locale: string;
  email: string;
  organizationId: string;
  doctorId: string;
  invite: InviteBundle;
  planId: AnnualPlanId;
}): Promise<{ checkoutUrl: string | null }> {
  assertStripeTestMode();
  const allowed = await assertOfferCheckoutAllowed({
    email: input.email,
    planId: input.planId,
    offer: input.invite.offer,
    extraPromotionCode: null,
    organizationId: input.organizationId,
  });
  if (!allowed.ok) throw new Error(allowed.error);

  const tier = input.planId === "starter_annual" ? "starter" : "professional";
  const tierConfig = getLicenseTier(tier);
  const priceId = await priceIdForPlan(input.planId);
  const admin = createAdminClient();

  const fields = buildOfferCheckoutFields({
    offer: input.invite.offer,
    priceId,
    organizationId: input.organizationId,
    doctorId: input.doctorId,
    tier,
    planId: input.planId,
    inviteId: input.invite.inviteId,
    specialtySlug: input.invite.specialtySlug,
    seatCount: "1",
    maxSeats: String(tierConfig?.includedSeats || 1),
  });

  const session = await runCheckoutAfterAttributionClaim({
    claim: () =>
      claimOfferAttribution(admin, {
        inviteId: input.invite.inviteId,
        offerId: input.invite.offer.id,
        specialtySlug: input.invite.specialtySlug,
        email: input.email,
        doctorId: input.doctorId,
        organizationId: input.organizationId,
      }),
    createSession: async () => {
      const { data: org } = await admin
        .from("organizations")
        .select("stripe_customer_id")
        .eq("id", input.organizationId)
        .maybeSingle();

      let customerId = org?.stripe_customer_id as string | null;
      if (!customerId) {
        const customer = await input.stripe.customers.create({
          email: input.email,
          metadata: {
            organization_id: input.organizationId,
            doctor_id: input.doctorId,
          },
        });
        customerId = customer.id;
        await admin
          .from("organizations")
          .update({ stripe_customer_id: customerId })
          .eq("id", input.organizationId);
      }

      return input.stripe.checkout.sessions.create({
        customer: customerId,
        success_url: `${input.origin}/${input.locale}/verify-email?email=${encodeURIComponent(input.email)}&checkout=success`,
        cancel_url: `${input.origin}/${input.locale}/register-doctor/offer?invite=${encodeURIComponent(input.invite.token)}&checkout=cancelled`,
        ...fields,
      });
    },
  });

  await admin
    .from("subscription_offer_invites")
    .update({ checkout_started_at: new Date().toISOString() })
    .eq("id", input.invite.inviteId);

  return { checkoutUrl: session.url };
}

async function claimOfferAttribution(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    inviteId: string;
    offerId: string;
    specialtySlug: string;
    email: string;
    doctorId: string;
    organizationId: string;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const attempted = {
    inviteId: input.inviteId,
    offerId: input.offerId,
    doctorId: input.doctorId,
  };
  const { error } = await admin.from("subscription_offer_attributions").insert({
    invite_id: input.inviteId,
    offer_id: input.offerId,
    specialty_slug: input.specialtySlug,
    doctor_email: input.email,
    doctor_id: input.doctorId,
    organization_id: input.organizationId,
    status: "account_created",
  });
  if (!error) return { ok: true };

  let existing: {
    inviteId: string | null;
    offerId: string;
    doctorId: string | null;
  } | null = null;
  if (error.code === "23505") {
    const { data: byDoctor } = await admin
      .from("subscription_offer_attributions")
      .select("invite_id, offer_id, doctor_id")
      .eq("doctor_id", input.doctorId)
      .maybeSingle();
    const { data: byInvite } = await admin
      .from("subscription_offer_attributions")
      .select("invite_id, offer_id, doctor_id")
      .eq("invite_id", input.inviteId)
      .maybeSingle();
    const row = byDoctor || byInvite;
    if (row) {
      existing = {
        inviteId: row.invite_id,
        offerId: row.offer_id,
        doctorId: row.doctor_id,
      };
    }
  } else {
    log.error("Offer attribution insert failed", { err: error });
  }
  const outcome = attributionClaimOutcome({
    errorCode: error.code ?? "error",
    existing,
    attempted,
  });
  if (!outcome.ok) return { ok: false, error: outcome.error };
  return { ok: true };
}

export async function loadInviteForCheckout(token: string): Promise<InviteBundle | null> {
  return loadInvite(token);
}

export function planIdFromTier(tier: string): AnnualPlanId | null {
  return annualPlanIdForTier(tier);
}

export async function recordSubscribedAttribution(input: {
  offerId: string;
  inviteId: string | null;
  specialty: string | null;
  subscriptionId: string;
  organizationId: string;
}): Promise<void> {
  const admin = createAdminClient();
  if (input.inviteId) {
    await admin
      .from("subscription_offer_attributions")
      .update({
        status: "subscribed",
        stripe_subscription_id: input.subscriptionId,
        organization_id: input.organizationId,
      })
      .eq("invite_id", input.inviteId);
    await admin
      .from("subscription_offer_invites")
      .update({ redeemed_at: new Date().toISOString() })
      .eq("id", input.inviteId);
  }
  log.info("Offer attribution subscribed", {
    offerId: input.offerId,
    specialty: input.specialty,
    subscriptionId: input.subscriptionId,
  });
}
