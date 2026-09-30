import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function exportBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  if (start < 0) return "";
  const next = source.indexOf("\nexport async function ", start + 1);
  return source.slice(start, next === -1 ? undefined : next);
}

describe("adaptive pricing stays off for launch prices", () => {
  it("disables adaptive pricing on doctor subscription checkout, including founding", () => {
    const auth = read("src/actions/auth.ts");
    for (const name of [
      "registerDoctorWithCheckout",
      "resumeDoctorLicenseCheckout",
    ]) {
      const body = exportBody(auth, name);
      expect(body, name).toContain("stripe.checkout.sessions.create");
      expect(body, name).toContain("adaptive_pricing: { enabled: false }");
    }

    const license = exportBody(read("src/actions/license.ts"), "createLicenseCheckout");
    expect(license).toContain("adaptive_pricing: { enabled: false }");

    const doctor = exportBody(
      read("src/actions/doctor.ts"),
      "createSubscriptionCheckout"
    );
    expect(doctor).toContain("adaptive_pricing: { enabled: false }");
  });

  it("does not add adaptive pricing to disabled treatment-plan checkout", () => {
    const src = read("src/actions/treatment-plan.ts");
    expect(src).toContain("checkout.sessions.create");
    expect(src).not.toContain("adaptive_pricing");
    expect(src).not.toContain("automatic_tax");
  });
});
