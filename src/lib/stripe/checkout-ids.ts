/** Checkout Sessions integration_identifier (API 2026-03-25+). */

const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function randomLetters(n: number): string {
  let out = "";
  for (let i = 0; i < n; i++) {
    out += LETTERS[Math.floor(Math.random() * LETTERS.length)];
  }
  return out;
}

/** Tag licence Checkout sessions for Dashboard comparison. */
export function licenseCheckoutIntegrationId(): string {
  return `mydoctors360_license_${randomLetters(8)}`;
}

/**
 * Fields the Node SDK types (stripe@20) do not yet include.
 * Runtime Checkout API accepts integration_identifier on 2026-03-25+.
 */
export function licenseCheckoutTrackingFields(): {
  billing_address_collection: "auto";
  integration_identifier: string;
} {
  return {
    billing_address_collection: "auto",
    integration_identifier: licenseCheckoutIntegrationId(),
  };
}
