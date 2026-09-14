import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("GTM P0 wiring", () => {
  it("book page uses founding-aware effective licence, not any free row", () => {
    const page = read(
      "src/app/[locale]/(public)/doctors/[slug]/book/page.tsx"
    );
    expect(page).toContain("is_founding_member");
    expect(page).toContain("bookPageAllowsOnlineBookings");
    expect(page).not.toMatch(/eq\("tier", "free"\)/);
  });

  it("Connect complete is charges_enabled AND payouts_enabled", () => {
    const webhook = read("src/app/api/webhooks/stripe/route.ts");
    expect(webhook).toContain("connectAccountIsReady");
    expect(webhook).not.toMatch(
      /stripe_onboarding_complete:\s*account\.details_submitted/
    );
  });

  it("deauthorized handler uses event.account, not application id", () => {
    const webhook = read("src/app/api/webhooks/stripe/route.ts");
    expect(webhook).toContain("deauthorizedConnectedAccountId");
    expect(webhook).toContain("event.account");
  });

  it("care-plan pay-in-full metadata includes booking_id", () => {
    const plan = read("src/actions/treatment-plan.ts");
    expect(plan).toMatch(/booking_id:\s*booking\.id/);
    const webhook = read("src/app/api/webhooks/stripe/route.ts");
    expect(webhook).toContain("bookingIdFromCheckoutMetadata");
  });

  it("wallet-only booking and invoice pay the connected account", () => {
    const booking = read("src/actions/booking.ts");
    expect(booking).toContain("payoutWalletToConnectedAccount");
    expect(booking).toContain("shouldRefundStripeToCard");
    expect(booking).toContain("reverseDestinationTransferToPlatform");
    const invoices = read("src/actions/invoices.ts");
    expect(invoices).toContain("payoutWalletToConnectedAccount");
  });

  it("signup trigger never assigns admin from metadata", () => {
    const sql = read("supabase/migrations/00109_gtm_p0_signup_rls.sql");
    expect(sql).toMatch(/WHEN NEW\.raw_user_meta_data->>'role' = 'doctor'/);
    expect(sql).toMatch(/ELSE 'patient'/);
    expect(sql).toContain('DROP POLICY IF EXISTS "Anyone can read by token"');
    expect(sql).toContain('DROP POLICY IF EXISTS "read_invitations"');
    expect(sql).not.toMatch(/THEN 'admin'/);
  });

  it("public token pages load via service role after dropping open SELECT", () => {
    for (const rel of [
      "src/app/[locale]/(public)/treatment-plan/[token]/page.tsx",
      "src/app/[locale]/(public)/treatment-plan/[token]/confirmed/page.tsx",
      "src/app/[locale]/(public)/invitation/[token]/page.tsx",
      "src/app/[locale]/(public)/invitation/[token]/confirmed/page.tsx",
    ]) {
      const src = read(rel);
      expect(src, rel).toContain("createAdminClient");
      expect(src, rel).not.toContain('@/lib/supabase/server');
    }
  });
});
