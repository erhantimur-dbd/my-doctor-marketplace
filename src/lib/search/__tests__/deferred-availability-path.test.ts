import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Structural regression: doctors page must not block first paint on
 * getMultiDayAvailabilityBatch (symptom search latency), and deferred
 * multi-day data must actually reach DoctorCard state.
 */
describe("doctors page critical path", () => {
  const pagePath = join(
    process.cwd(),
    "src/app/[locale]/(public)/doctors/page.tsx"
  );
  const deferredPath = join(
    process.cwd(),
    "src/components/doctors/doctor-list-with-deferred-availability.tsx"
  );
  const cardPath = join(
    process.cwd(),
    "src/components/doctors/doctor-card.tsx"
  );

  it("ships DoctorListWithDeferredAvailability client enricher", () => {
    const src = readFileSync(deferredPath, "utf8");
    expect(src).toContain("getMultiDayAvailabilityBatch");
    expect(src).toContain("useEffect");
    expect(src).toContain("\"use client\"");
  });

  it("passes undefined availability until enrichment ready (not empty {} → null)", () => {
    const src = readFileSync(deferredPath, "utf8");
    // Must not start with useState({}) which makes hasAvailability true with null
    expect(src).toMatch(
      /useState<\s*Record<string,\s*DoctorMultiDayAvailability>\s*\|\s*undefined\s*>\(\s*undefined\s*\)/
    );
    expect(src).toContain("availability === undefined");
  });

  it("DoctorCard syncs cardAvailability when availability prop updates", () => {
    const src = readFileSync(cardPath, "utf8");
    // useEffect that applies parent availability after deferred fetch
    expect(src).toMatch(/useEffect\(\s*\(\)\s*=>\s*\{[\s\S]*setCardAvailability\(availability\)/);
    expect(src).toMatch(/},\s*\[availability\]\s*\)/);
    expect(src).toContain("localTypeOverrideRef");
  });

  it("doctors page does not await getMultiDayAvailabilityBatch on server", () => {
    const src = readFileSync(pagePath, "utf8");
    expect(src).not.toMatch(/await\s+getMultiDayAvailabilityBatch/);
    expect(src).toContain("DoctorListWithDeferredAvailability");
  });

  it("soonest sort skips second inventory re-rank batch in search.ts", () => {
    const searchSrc = readFileSync(
      join(process.cwd(), "src/actions/search.ts"),
      "utf8"
    );
    expect(searchSrc).toContain('filters.sort !== "soonest"');
    expect(searchSrc).toContain("shouldInventoryRank");
  });
});
