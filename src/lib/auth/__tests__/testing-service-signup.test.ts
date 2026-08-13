import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("testing-service register", () => {
  it("server action enforces passwordSchema and stamps terms", () => {
    const auth = read("src/actions/auth.ts");
    const fn = auth.slice(
      auth.indexOf("export async function registerTestingService"),
      auth.indexOf("export async function resendVerificationEmail")
    );
    expect(fn).toContain("passwordSchema");
    expect(fn).toContain("terms_accepted_at");
    expect(fn).toContain("TERMS_VERSION");
  });

  it("wizard submits practice fields the action persists", () => {
    const page = read(
      "src/app/[locale]/(public)/register-testing-service/page.tsx"
    );
    for (const key of [
      "clinic_name",
      "selected_specialties",
      "languages",
      "address",
      "city",
      "postal_code",
      "country",
    ]) {
      expect(page).toContain(`formData.set("${key}"`);
    }

    const auth = read("src/actions/auth.ts");
    const fn = auth.slice(
      auth.indexOf("export async function registerTestingService"),
      auth.indexOf("export async function resendVerificationEmail")
    );
    expect(fn).toContain('formData.get("clinic_name")');
    expect(fn).toContain('formData.get("selected_specialties")');
    expect(fn).toContain('formData.get("languages")');
    expect(fn).toContain("clinic_name");
    expect(fn).toContain("doctor_specialties");
  });
});
