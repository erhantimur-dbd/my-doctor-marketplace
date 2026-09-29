import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

/**
 * Static contract for Article 15/20 export shape.
 * Keeps GTM GDPR claims honest about which domains ship in the portable JSON.
 */
describe("exportPatientData GDPR coverage", () => {
  const source = readFileSync(
    join(process.cwd(), "src/actions/patient.ts"),
    "utf8"
  );

  const requiredDomains = [
    "bookings",
    "reviews",
    "invoices",
    "patient_wallet",
    "wallet_transactions",
    "post_visit_feedback",
    "satisfaction_surveys",
    "cookie_consents",
    "medical_profiles",
  ];

  it("exports format_version 1.1 with billing, wallet, and feedback domains", () => {
    expect(source).toContain('format_version: "1.1"');
    for (const domain of requiredDomains) {
      expect(source).toContain(`.from("${domain}")`);
    }
    expect(source).toContain("wallet_balances:");
    expect(source).toContain("wallet_transactions:");
    expect(source).toContain("post_visit_feedback:");
    expect(source).toContain("satisfaction_surveys:");
    expect(source).toContain("invoices:");
  });

  it("omits private post-visit free-text notes from portable export", () => {
    expect(source).not.toMatch(
      /\.from\("post_visit_feedback_notes"\)/
    );
  });
});
