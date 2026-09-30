import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const aboutUk = readFileSync(
  join(process.cwd(), "src/app/[locale]/(public)/about/about-uk.tsx"),
  "utf8"
);

describe("UK About GMC sentence", () => {
  it("describes the stored number, an admin register check, and the nightly CQC and indemnity re-check", () => {
    expect(aboutUk).toContain(
      "We store each doctor&rsquo;s GMC number, an admin checks it on the public"
    );
    expect(aboutUk).toContain(
      "GMC register before the doctor goes live, and a nightly job re-checks"
    );
    expect(aboutUk).toContain("CQC and indemnity dates.");
  });

  it("does not claim an automatic GMC register re-check", () => {
    expect(aboutUk).not.toContain("re-check it on a regular cycle");
    expect(aboutUk).not.toMatch(
      /re-checks? (?:it|the GMC|GMC registration|the public GMC|the register)/i
    );
    expect(aboutUk).not.toMatch(/automatic/i);
  });
});
