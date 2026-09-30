import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FOUNDING_PRICING_NOTE } from "@/lib/founding/pricing-note";
import {
  claimFoundingOnPayment,
  claimedSpotCount,
  emptyFoundingProgramme,
  endFoundingFeatured,
  openFoundingCheckout,
  releaseFoundingCheckout,
} from "@/lib/founding/spot-lifecycle";

const PERIOD_END = "2026-10-30T12:00:00.000Z";
const PERIOD_ENDED = "2026-11-30T12:00:00.000Z";

describe("founding spot is not claimed at checkout", () => {
  it("creating checkout reserves a spot and does not mark the doctor featured", () => {
    const opened = openFoundingCheckout(
      emptyFoundingProgramme(),
      "doc-1",
      "cs_test_1"
    );
    expect(opened.reserved).toBe(true);
    expect(opened.state.doctors["doc-1"].isFoundingMember).toBe(false);
    expect(opened.state.doctors["doc-1"].foundingNumber).toBeNull();
    expect(opened.state.doctors["doc-1"].isFeatured).toBe(false);
    expect(opened.state.doctors["doc-1"].featuredUntil).toBeNull();
    expect(claimedSpotCount(opened.state)).toBe(0);
    expect(opened.state.reservations).toEqual([
      { doctorId: "doc-1", sessionId: "cs_test_1", status: "pending" },
    ]);
    expect(JSON.stringify(opened.state)).not.toContain("2099");
  });
});

describe("founding spot claim on payment", () => {
  it("claims exactly once and a replay does not double-count", () => {
    const opened = openFoundingCheckout(
      emptyFoundingProgramme(),
      "doc-1",
      "cs_test_1"
    );
    const first = claimFoundingOnPayment(opened.state, "doc-1", PERIOD_END);
    expect(first.newlyClaimed).toBe(true);
    expect(first.foundingNumber).toBe(1);
    expect(claimedSpotCount(first.state)).toBe(1);
    expect(first.state.doctors["doc-1"].isFeatured).toBe(true);
    expect(first.state.doctors["doc-1"].featuredUntil).toBe(PERIOD_END);
    expect(first.state.reservations[0].status).toBe("converted");

    const replay = claimFoundingOnPayment(first.state, "doc-1", PERIOD_END);
    expect(replay.newlyClaimed).toBe(false);
    expect(replay.foundingNumber).toBe(1);
    expect(claimedSpotCount(replay.state)).toBe(1);
    expect(replay.state.doctors["doc-1"].featuredUntil).not.toContain("2099");
  });

  it("an expired session releases the reservation and does not claim", () => {
    const opened = openFoundingCheckout(
      emptyFoundingProgramme(1),
      "doc-1",
      "cs_expire"
    );
    const released = releaseFoundingCheckout(opened.state, "cs_expire");
    expect(released.reservations[0].status).toBe("released");
    expect(released.doctors["doc-1"].isFoundingMember).toBe(false);
    expect(claimedSpotCount(released)).toBe(0);

    const next = openFoundingCheckout(released, "doc-2", "cs_next");
    expect(next.reserved).toBe(true);
    expect(claimedSpotCount(next.state)).toBe(0);
  });

  it("ending the subscription ends featured on the subscription date", () => {
    const opened = openFoundingCheckout(
      emptyFoundingProgramme(),
      "doc-1",
      "cs_test_1"
    );
    const claimed = claimFoundingOnPayment(opened.state, "doc-1", PERIOD_END);
    const ended = endFoundingFeatured(claimed.state, "doc-1", PERIOD_ENDED);
    expect(ended.doctors["doc-1"].isFoundingMember).toBe(true);
    expect(ended.doctors["doc-1"].isFeatured).toBe(false);
    expect(ended.doctors["doc-1"].featuredUntil).toBe(PERIOD_ENDED);
    expect(ended.doctors["doc-1"].featuredUntil).not.toContain("2099");
  });
});

describe("founding payment wiring", () => {
  const root = process.cwd();
  const read = (rel: string) => readFileSync(join(root, rel), "utf8");

  it("migration 00118 claims on payment, releases on expiry, and drops the lifetime price note", () => {
    const sql = read("supabase/migrations/00118_founding_claim_on_payment.sql");
    expect(sql).toContain("reserve_founding_spot");
    expect(sql).toContain("release_founding_spot_reservation");
    expect(sql).toContain("IF FOUND AND v_existing IS NOT NULL THEN");
    expect(sql).toContain(FOUNDING_PRICING_NOTE);
    expect(sql).not.toMatch(/for life/i);
    expect(sql).not.toContain("2099");
    expect(read("src/lib/founding/members.ts")).toContain("FOUNDING_PRICING_NOTE");
    expect(read("src/lib/founding/pricing-note.ts")).not.toMatch(/for life/i);
  });
});
