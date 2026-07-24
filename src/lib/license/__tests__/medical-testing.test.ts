import { describe, expect, it } from "vitest";
import {
  canToggleMedicalTestingModule,
  hasTestingAddonAtAccountCreate,
  isMedicalTestingIncludedInTier,
  isTestingAddonPriceMetadata,
  medicalTestingModeForTier,
  shouldChargeTestingAddonAtCheckout,
  shouldGrantTestingAfterLicenseActive,
} from "../medical-testing";

describe("medicalTestingModeForTier", () => {
  it("denies free and unknown", () => {
    expect(medicalTestingModeForTier("free")).toBe("denied");
    expect(medicalTestingModeForTier(null)).toBe("denied");
    expect(medicalTestingModeForTier("")).toBe("denied");
  });

  it("marks starter/professional as paid add-on", () => {
    expect(medicalTestingModeForTier("starter")).toBe("paid_addon");
    expect(medicalTestingModeForTier("professional")).toBe("paid_addon");
  });

  it("marks clinic/enterprise as included", () => {
    expect(medicalTestingModeForTier("clinic")).toBe("included");
    expect(medicalTestingModeForTier("enterprise")).toBe("included");
    expect(isMedicalTestingIncludedInTier("clinic")).toBe(true);
  });
});

describe("shouldChargeTestingAddonAtCheckout", () => {
  it("never charges free or included tiers", () => {
    expect(
      shouldChargeTestingAddonAtCheckout({ tier: "free", formWantsAddon: true })
    ).toBe(false);
    expect(
      shouldChargeTestingAddonAtCheckout({
        tier: "clinic",
        formWantsAddon: true,
      })
    ).toBe(false);
  });

  it("charges starter/pro only when opted in", () => {
    expect(
      shouldChargeTestingAddonAtCheckout({
        tier: "starter",
        formWantsAddon: true,
      })
    ).toBe(true);
    expect(
      shouldChargeTestingAddonAtCheckout({
        tier: "professional",
        formWantsAddon: false,
      })
    ).toBe(false);
  });
});

describe("hasTestingAddonAtAccountCreate", () => {
  it("never grants durable flag before payment", () => {
    expect(hasTestingAddonAtAccountCreate()).toBe(false);
  });
});

describe("shouldGrantTestingAfterLicenseActive", () => {
  it("grants clinic without price item", () => {
    expect(
      shouldGrantTestingAfterLicenseActive({
        tier: "clinic",
        hasTestingPriceItem: false,
      })
    ).toBe(true);
  });

  it("grants starter only when testing price item is present", () => {
    expect(
      shouldGrantTestingAfterLicenseActive({
        tier: "starter",
        hasTestingPriceItem: true,
        metadataHasTestingAddon: false,
      })
    ).toBe(true);
    expect(
      shouldGrantTestingAfterLicenseActive({
        tier: "starter",
        hasTestingPriceItem: false,
        metadataHasTestingAddon: true,
      })
    ).toBe(false);
    expect(
      shouldGrantTestingAfterLicenseActive({
        tier: "starter",
        metadataHasTestingAddon: true,
      })
    ).toBe(false);
  });

  it("never grants free", () => {
    expect(
      shouldGrantTestingAfterLicenseActive({
        tier: "free",
        hasTestingPriceItem: true,
      })
    ).toBe(false);
  });
});

describe("shouldRevokePaidTestingAddon", () => {
  it("revokes starter when item gone", async () => {
    const { shouldRevokePaidTestingAddon } = await import(
      "../medical-testing"
    );
    expect(
      shouldRevokePaidTestingAddon({
        tier: "starter",
        hasTestingPriceItem: false,
      })
    ).toBe(true);
    expect(
      shouldRevokePaidTestingAddon({
        tier: "clinic",
        hasTestingPriceItem: false,
      })
    ).toBe(false);
  });
});

describe("canToggleMedicalTestingModule", () => {
  it("blocks free", () => {
    const r = canToggleMedicalTestingModule("free");
    expect(r.ok).toBe(false);
  });

  it("allows paid_addon and included", () => {
    expect(canToggleMedicalTestingModule("starter")).toEqual({
      ok: true,
      mode: "paid_addon",
    });
    expect(canToggleMedicalTestingModule("clinic")).toEqual({
      ok: true,
      mode: "included",
    });
  });
});

describe("isTestingAddonPriceMetadata", () => {
  it("matches addon price types", () => {
    expect(isTestingAddonPriceMetadata({ type: "medical_testing_addon" })).toBe(
      true
    );
    expect(
      isTestingAddonPriceMetadata({ type: "medical_testing_addon_annual" })
    ).toBe(true);
    expect(isTestingAddonPriceMetadata({ type: "extra_seat" })).toBe(false);
  });
});
