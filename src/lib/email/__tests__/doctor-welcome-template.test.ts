import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { doctorWelcomeEmail, welcomeEmail } from "@/lib/email/templates";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

function exportBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe("doctorWelcomeEmail", () => {
  it("tells a new doctor to verify email, finish the profile, connect Stripe, and wait for verification", () => {
    const { subject, html } = doctorWelcomeEmail({ name: "Ada" });

    expect(subject).toMatch(/doctor account/i);
    expect(html).toContain("Ada");
    expect(html).toContain("Verify your email");
    expect(html).toContain("Finish your profile");
    expect(html).toContain("Connect Stripe");
    expect(html).toContain("Wait for verification");
  });

  it("drops the patient browse copy, the phone-consultation claim, and the dead Explore Doctors button", () => {
    const { html } = doctorWelcomeEmail({ name: "Ada" });

    expect(html).not.toMatch(/phone consultation/i);
    expect(html).not.toContain("Explore Doctors");
    expect(html).not.toContain('href="#"');
    expect(html).not.toMatch(/browse and discover/i);
  });
});

describe("doctor registration sends the doctor welcome", () => {
  const auth = read("src/actions/auth.ts");

  it("registerDoctor and registerDoctorWithCheckout use doctorWelcomeEmail", () => {
    for (const name of ["registerDoctor", "registerDoctorWithCheckout"]) {
      const body = exportBody(auth, name);
      expect(body).toMatch(/doctorWelcomeEmail\(/);
      expect(body).not.toMatch(/(?<!doctor)welcomeEmail\(/);
    }
  });

  it("patient register still uses the patient welcome", () => {
    const body = exportBody(auth, "register");
    expect(body).toMatch(/(?<!doctor)welcomeEmail\(/);
    expect(body).not.toMatch(/doctorWelcomeEmail\(/);
    const { html } = welcomeEmail({ name: "Ada" });
    expect(html).toContain("Explore Doctors");
  });
});
