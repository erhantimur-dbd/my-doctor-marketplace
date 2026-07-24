/**
 * Medical Testing entitlement — single product signal: doctors.has_testing_addon.
 *
 * - Free: never
 * - Starter / Professional: paid £49 add-on (Stripe subscription item)
 * - Clinic / Enterprise: included with the licence (no extra fee)
 */

export type MedicalTestingMode = "denied" | "paid_addon" | "included";

/** How testing is sold for a licence tier. */
export function medicalTestingModeForTier(
  tier: string | null | undefined
): MedicalTestingMode {
  if (tier === "clinic" || tier === "enterprise") return "included";
  if (tier === "starter" || tier === "professional") return "paid_addon";
  return "denied";
}

/** True when Clinic/Enterprise should unlock testing without a paid module. */
export function isMedicalTestingIncludedInTier(
  tier: string | null | undefined
): boolean {
  return medicalTestingModeForTier(tier) === "included";
}

/**
 * Register form → whether Checkout should charge the add-on line item.
 * Free never; Clinic/Enterprise never (included after licence pay);
 * Starter/Pro only when the doctor opted in.
 */
export function shouldChargeTestingAddonAtCheckout(params: {
  tier: string | null | undefined;
  formWantsAddon: boolean;
}): boolean {
  if (medicalTestingModeForTier(params.tier) !== "paid_addon") return false;
  return params.formWantsAddon === true;
}

/**
 * Value written on doctors.has_testing_addon at account create.
 * Always false so abandoned Checkout cannot leave a durable free unlock.
 * Webhook / billing grant after payment or included-tier activation.
 */
export function hasTestingAddonAtAccountCreate(): boolean {
  return false;
}

/**
 * After a paid licence is active/trialing, should we grant testing?
 * - included tiers always
 * - paid add-on only when a testing price item is on the subscription
 *   (metadata alone is not enough — disable clears items + metadata)
 */
export function shouldGrantTestingAfterLicenseActive(params: {
  tier: string | null | undefined;
  /** @deprecated use hasTestingPriceItem for paid_addon */
  metadataHasTestingAddon?: boolean;
  /** True when subscription has a Medical Testing add-on line item */
  hasTestingPriceItem?: boolean;
}): boolean {
  if (isMedicalTestingIncludedInTier(params.tier)) return true;
  if (medicalTestingModeForTier(params.tier) === "paid_addon") {
    if (params.hasTestingPriceItem === true) return true;
    if (params.hasTestingPriceItem === false) return false;
    // Unknown item state: do not grant from metadata alone (prevents re-unlock after disable)
    return false;
  }
  return false;
}

/** Whether webhook should clear testing when paid sub is active but add-on was removed */
export function shouldRevokePaidTestingAddon(params: {
  tier: string | null | undefined;
  hasTestingPriceItem: boolean;
}): boolean {
  return (
    medicalTestingModeForTier(params.tier) === "paid_addon" &&
    !params.hasTestingPriceItem
  );
}

/**
 * Billing toggle: may this org enable/disable testing on this licence?
 * Free → no. Included and paid_addon → yes (Stripe only for paid_addon enable).
 */
export function canToggleMedicalTestingModule(
  tier: string | null | undefined
): { ok: true; mode: Exclude<MedicalTestingMode, "denied"> } | { ok: false; reason: string } {
  const mode = medicalTestingModeForTier(tier);
  if (mode === "denied") {
    return {
      ok: false,
      reason:
        "Medical Testing is not available on Founding Free. Upgrade to Starter or higher.",
    };
  }
  return { ok: true, mode };
}

/** Stripe price metadata types used by getOrCreateTestingAddonPriceId */
export const TESTING_ADDON_PRICE_TYPES = [
  "medical_testing_addon",
  "medical_testing_addon_annual",
] as const;

export function isTestingAddonPriceMetadata(
  metadata: Record<string, string> | null | undefined
): boolean {
  const t = metadata?.type;
  return (
    t === "medical_testing_addon" || t === "medical_testing_addon_annual"
  );
}
