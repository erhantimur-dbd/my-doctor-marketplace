import { describe, expect, it } from "vitest";
import { getSiteMode, isDemoSite } from "@/lib/site-mode";

describe("getSiteMode", () => {
  it("defaults to live when NEXT_PUBLIC_SITE_MODE is unset", () => {
    expect(getSiteMode()).toBe("live");
    expect(isDemoSite()).toBe(false);
  });
});
