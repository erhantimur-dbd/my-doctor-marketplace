import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  PATIENT_WAITLIST_REGION,
  patientWaitlistRow,
} from "@/lib/waitlist/patient-waitlist";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("patient waitlist details", () => {
  it("saves name and email only, with no discount entitlement", () => {
    const row = patientWaitlistRow({
      name: "  Ada Patient  ",
      email: "Ada@Example.com",
    });

    expect(row).toEqual({
      name: "Ada Patient",
      email: "ada@example.com",
      region: PATIENT_WAITLIST_REGION,
    });
    expect(Object.keys(row).sort()).toEqual(["email", "name", "region"]);
    expect(row).not.toHaveProperty("discount_percent");
    expect(row).not.toHaveProperty("entitlement_kind");
  });

  it("does not write a discount, coupon, or checkout change", () => {
    const route = read("src/app/api/waitlist/patient/route.ts");
    const lib = read("src/lib/waitlist/patient-waitlist.ts");
    for (const [rel, text] of [
      ["route", route],
      ["lib", lib],
    ] as const) {
      expect(text, rel).toMatch(/launch_notifications/);
      expect(text, rel).not.toMatch(/discount_percent|entitlement_kind|patient_launch_discount/);
      expect(text, rel).not.toMatch(/stripe|coupon|promotion code/i);
    }
    expect(route).toContain("patientWaitlistRow");
    expect(route).not.toMatch(/checkout/i);
  });
});

describe("coming-soon page copy", () => {
  const html = read("public/coming-soon/index.html");

  it("says coming soon and keeps the £99 doctor offer without a patient 15% offer", () => {
    expect(html).toMatch(/Coming soon/);
    expect(html).toMatch(/£99 per month for the first 100 doctors/);
    expect(html).toMatch(/No minimum term, cancel anytime/);
    expect(html).toMatch(
      /The price stays £99 per month for as long as you keep the plan/
    );
    expect(html).toMatch(
      /If you cancel, you lose the £99 price and cannot rejoin at £99/
    );
    expect(html).toMatch(
      /The 15% platform fee on consultations still applies and is not discounted/
    );
    expect(html).toMatch(/£199/);
    expect(html).toMatch(/£299/);
    expect(html).toMatch(/Patient search is closed/);
    expect(html).toMatch(/video consultation/i);
    expect(html).toMatch(/in-person/i);
    expect(html).toMatch(/register-doctor\?tier=founding&founding=1/);
    expect(html).toMatch(/href="\/en\/privacy"/);
    expect(html).toMatch(
      /We'll only email you about the launch\. Every email has an unsubscribe link\./
    );
    expect(html).not.toMatch(/and this offer/);
    expect(html).toMatch(
      /We'll only use your details as set out in our <a href="\/en\/privacy">Privacy notice<\/a>/
    );
    expect(
      html.match(/We'll only use your details as set out in our/g)?.length
    ).toBe(2);
    expect(html).not.toMatch(/never share/i);
    expect(html).toMatch(/activity statements/);
    expect(html).toMatch(/United Kingdom/);
    expect(html).not.toMatch(/15%\s*off/i);
    expect(html).not.toMatch(/patient discount/i);
    expect(html).not.toMatch(/not the 15% platform commission/i);
    expect(html).not.toMatch(/medical testing/i);
    expect(html).not.toMatch(/No contract/i);
    expect(html).not.toMatch(/Priority placement/i);
    expect(html).not.toMatch(/messaging and AI/i);
    expect(html).not.toMatch(/invoices handled/i);
    expect(html).not.toMatch(/The form is empty/i);
    expect(html).not.toMatch(/Ireland|Italy|Spain|Germany|France|Portugal|Poland|Turkey/);
    expect(html).not.toMatch(/Founding Free|£0|no card|lifetime free|free forever/i);
    expect(html).not.toMatch(/launch date/i);
    expect(html).not.toMatch(/discount_percent|entitlement_kind|patient_launch_discount/);
    expect(html).not.toMatch(/coupon|promotion code/i);
  });

  it("waitlist form has empty, success, and error states and only asks for name and email", () => {
    expect(html).toMatch(/id="patientWaitlistForm"/);
    expect(html).toMatch(/data-state="empty"/);
    expect(html).toMatch(/id="patientFormSuccess"/);
    expect(html).toMatch(/id="patientFormError"/);
    expect(html).toMatch(/\/api\/waitlist\/patient/);
    expect(html).toMatch(/id="patientName"/);
    expect(html).toMatch(/id="patientEmail"/);
    expect(html).not.toMatch(/id="patientName"[^>]*value=/);
    expect(html).not.toMatch(/id="patientEmail"[^>]*value=/);
  });
});
