import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PrivacyDefault } from "./privacy-default";
import { PRIVACY_PUBLISH_DATE } from "./privacy-publish-date";
import { PrivacyUk } from "./privacy-uk";

const JOHN_PARAGRAPH =
  "If you ask us to delete your account, we'll close it, remove your name, email, phone number and address, and delete anything we don't need to keep. Some records must be kept by law or for your care, even after your account is closed. These include consultation and prescription records (usually 8 years after your last consultation, longer for children), payment and booking records (6 years for tax and legal reasons), and doctor registration and insurance details (6 years after a doctor leaves). We keep these securely with access restricted, use them only for those reasons, and delete them when the period ends. You can still ask to see them.";

const SHARED_BULLETS = [
  "Booking and consultation-booking records: 6 years after the end of the financial year in which the booking took place, for tax and legal reasons. Your name and contact details are removed if you close your account.",
  "Payment, refund, wallet credit and statement records: 6 years after the end of the financial year in which the payment took place, as required for tax (HMRC) and legal claims.",
  "Medical and consultation records (including prescriptions, consultation notes, and health information shared with a doctor for a booking): for adults, 8 years after your last consultation; for children, until their 25th birthday (26th if they were 17 at their last consultation), or 8 years, whichever is later. These records are kept even if you close your account or ask us to delete your data, because the law and your ongoing care require it. Access is restricted, and you can still ask to see them. Health information you entered but never shared with a doctor for a booking is deleted when you ask.",
  "Prescription audit records: kept for the same period as the prescription they relate to, and cannot be altered.",
  "Security and access logs: 2 years.",
] as const;

const UK_ONLY_BULLET =
  "Where your doctor is the controller of your clinical record, they are responsible for it under their own professional duties and may keep it longer than the periods above. Please contact your doctor about their records.";

const PENDING_BOOKINGS =
  "Pending bookings — Automatically deleted after 15 minutes (patient) or 48 hours (admin-created) if payment is not completed.";

const REMOVED = [
  "deleted on account deletion",
  "Retained for 7 years",
  "until you request deletion",
  "until you request erasure",
] as const;

function visibleText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

describe("privacy data retention", () => {
  const defaultText = visibleText(
    renderToStaticMarkup(createElement(PrivacyDefault))
  );
  const ukText = visibleText(renderToStaticMarkup(createElement(PrivacyUk)));

  it("shows the same effective and last-updated date from the shared constant", () => {
    for (const text of [defaultText, ukText]) {
      expect(text).toContain(`Effective Date: ${PRIVACY_PUBLISH_DATE}`);
      expect(text).toContain(`Last updated: ${PRIVACY_PUBLISH_DATE}`);
    }
    expect(PRIVACY_PUBLISH_DATE).not.toBe("");
  });

  it("renders Legal's retention bullets and John's paragraph", () => {
    for (const text of [defaultText, ukText]) {
      expect(text).toContain(JOHN_PARAGRAPH);
      for (const bullet of SHARED_BULLETS) {
        expect(text).toContain(bullet);
      }
      expect(text).toContain(PENDING_BOOKINGS);
    }

    expect(ukText).toContain(UK_ONLY_BULLET);
    expect(defaultText).not.toContain(UK_ONLY_BULLET);

    const defaultOrder = [
      ...SHARED_BULLETS,
      PENDING_BOOKINGS,
    ];
    let last = -1;
    for (const part of defaultOrder) {
      const index = defaultText.indexOf(part);
      expect(index).toBeGreaterThan(last);
      last = index;
    }

    const ukOrder = [
      ...SHARED_BULLETS,
      UK_ONLY_BULLET,
      PENDING_BOOKINGS,
    ];
    last = -1;
    for (const part of ukOrder) {
      const index = ukText.indexOf(part);
      expect(index).toBeGreaterThan(last);
      last = index;
    }
  });

  it("does not keep the old deletion and retention sentences", () => {
    for (const text of [defaultText, ukText]) {
      for (const old of REMOVED) {
        expect(text).not.toContain(old);
      }
    }
  });
});
