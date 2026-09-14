import { afterEach, describe, expect, it } from "vitest";
import {
  getEnvLicensePriceId,
  getOrCreateLicensePriceId,
  getLicenseTier,
} from "@/lib/constants/license-tiers";
import { licenseCheckoutIntegrationId } from "@/lib/stripe/checkout-ids";

const KEYS = [
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_PROFESSIONAL",
  "STRIPE_PRICE_CLINIC",
  "STRIPE_PRICE_STARTER_ANNUAL",
] as const;

const saved: Record<string, string | undefined> = {};

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
    delete saved[key];
  }
});

function stub(key: string, value: string) {
  saved[key] = process.env[key];
  process.env[key] = value;
}

describe("licence catalogue env", () => {
  it("accepts Dashboard price_ IDs and rejects placeholders", () => {
    stub("STRIPE_PRICE_STARTER", "price_1UDOzxPhJvj3ftQeKXwKmY6h");
    expect(getEnvLicensePriceId("starter")).toBe(
      "price_1UDOzxPhJvj3ftQeKXwKmY6h"
    );

    stub("STRIPE_PRICE_STARTER", "not_a_price");
    expect(getEnvLicensePriceId("starter")).toBeNull();
  });

  it("resolves annual Price IDs from STRIPE_PRICE_*_ANNUAL", async () => {
    stub("STRIPE_PRICE_STARTER_ANNUAL", "price_1UDP0HPhJvj3ftQe1NcJGSgk");
    const cfg = getLicenseTier("starter")!;
    await expect(
      getOrCreateLicensePriceId("starter", cfg, "annual")
    ).resolves.toBe("price_1UDP0HPhJvj3ftQe1NcJGSgk");
  });

  it("licenseCheckoutIntegrationId tags licence Checkout", () => {
    const id = licenseCheckoutIntegrationId();
    expect(id).toMatch(/^mydoctors360_license_[A-Za-z]{8}$/);
  });
});
