import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("treatment-plan server-action module", () => {
  it("starts with \"use server\" so client wizard imports stay valid", () => {
    const src = read("src/actions/treatment-plan.ts");
    const firstNonEmpty = src.split("\n").find((line) => line.trim());
    expect(firstNonEmpty).toBe('"use server";');
    expect(src).not.toMatch(/from "@\/lib\/utils\/feature-flags"/);
    expect(src).not.toMatch(/from "@\/lib\/license\/check"/);
  });
});
