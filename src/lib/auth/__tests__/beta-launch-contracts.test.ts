import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SOFT_LAUNCH_HIDE_PATIENT_MARKETPLACE_CHROME } from "@/lib/constants/company";

const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

describe("beta launch contracts", () => {
  it("Soft Launch chrome is off", () => {
    expect(SOFT_LAUNCH_HIDE_PATIENT_MARKETPLACE_CHROME).toBe(false);
  });

  it("vercel.json does not rewrite production hosts to coming-soon", () => {
    const vercel = read("vercel.json");
    expect(vercel).not.toMatch(/coming-soon\/index.html/);
  });

  it("catalog seed has no demo personas", () => {
    const catalog = read("supabase/seed-catalog.sql");
    expect(catalog).not.toMatch(/@example\.com/);
    expect(catalog).not.toMatch(/e0000000-0000-0000-0000-/);
    expect(catalog).toMatch(/INSERT INTO public.specialties/);
    expect(catalog).toMatch(/INSERT INTO public.locations/);
  });

  it("demo seed is isolated and seed.sql does not insert people", () => {
    const demo = read("supabase/seed-demo.sql");
    const wrapper = read("supabase/seed.sql");
    expect(demo).toMatch(/@example\.com/);
    expect(demo).toMatch(/Never run on live/);
    expect(wrapper).not.toMatch(/INSERT INTO public.doctors/);
    expect(wrapper).toMatch(/seed-catalog\.sql/);
  });

  it("admin is notified on doctor signup; search still requires verified", () => {
    const auth = read("src/actions/auth.ts");
    expect(auth).toContain("doctorSignupAdminEmail");
    const search = read("src/actions/search.ts");
    expect(search).toMatch(/verification_status["']?\s*,\s*["']?verified|eq\("verification_status", "verified"\)/);
  });
});
