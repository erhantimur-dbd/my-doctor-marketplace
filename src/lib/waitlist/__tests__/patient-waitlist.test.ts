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

  it("says coming soon, keeps the £99 doctor offer, and promises patients 15% off at launch", () => {
    expect(html).toMatch(/Coming soon/);
    expect(html).toMatch(/£99 per month for the first 100 doctors/);
    expect(html).toMatch(/cancel anytime/i);
    expect(html).toMatch(/If you cancel, you lose this price/);
    expect(html).toMatch(/15% off at launch/);
    expect(html).toMatch(/not the 15% platform commission/i);
    expect(html).toMatch(/Patient search is closed/);
    expect(html).toMatch(/video consultation/i);
    expect(html).toMatch(/in-person/i);
    expect(html).toMatch(/register-doctor\?tier=founding&founding=1/);
    expect(html).not.toMatch(/Founding Free|£0|no card|lifetime free|free forever/i);
    expect(html).not.toMatch(/launch date/i);
    expect(html).not.toMatch(/discount_percent|entitlement_kind|patient_launch_discount/);
    expect(html).not.toMatch(/we store a 15%|stored 15%/i);
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
