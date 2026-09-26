import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  doctorSidebarGroups,
  doctorSidebarLinks,
  withActivityStatementLink,
} from "@/lib/constants/sidebar-links";
import { renderActivityStatementHtml } from "@/lib/statements/render-activity-statement-html";
import { formatEmailDateTime } from "@/lib/email/format-appointment";
import { getCommissionCents } from "@/lib/utils/currency";
import {
  ACTIVITY_STATEMENT_FOOTER,
  ACTIVITY_STATEMENT_HREF,
  ACTIVITY_STATEMENT_TITLE,
  RESCHEDULE_BALANCE_LABEL,
  activityStatementSelect,
  allocateRefund,
  assertActivityStatementSelectIsSafe,
  buildActivityStatement,
  formatStatementMoney,
  inLondonRange,
  londonMonthBounds,
  parseStatementMonth,
  settleBookingFees,
  statementPatientLabel,
  type StatementBookingSource,
} from "@/lib/statements/activity-statement";

const FORBIDDEN = [
  "patient_notes",
  "doctor_notes",
  "visit_summary",
  "medical_profile",
];

function booking(overrides: Partial<StatementBookingSource> = {}): StatementBookingSource {
  return {
    bookingNumber: "BK-20260926-TEST",
    appointmentDate: "2026-09-26",
    startTime: "09:00",
    consultationType: "video",
    serviceName: null,
    status: "confirmed",
    currency: "GBP",
    consultationFeeCents: 4000,
    platformFeeCents: 0,
    commissionCents: getCommissionCents(4000),
    totalAmountCents: 4000,
    depositAmountCents: null,
    paymentMode: "full",
    walletCreditAppliedCents: 0,
    refundAmountCents: null,
    paidAt: "2026-09-26T08:00:00.000Z",
    refundedAt: null,
    stripePaymentIntentId: "pi_test",
    reschedulePriceDiffCents: 0,
    reschedulePaymentStatus: null,
    patientFirstName: "Amelia",
    patientLastName: "Chen",
    ...overrides,
  };
}

describe("Europe/London month bounds", () => {
  it("uses BST for September 2026 and GMT for January 2026", () => {
    const september = londonMonthBounds(2026, 9);
    expect(september.start.toISOString()).toBe("2026-08-31T23:00:00.000Z");
    expect(september.end.toISOString()).toBe("2026-09-30T23:00:00.000Z");

    const january = londonMonthBounds(2026, 1);
    expect(january.start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(january.end.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  it("keeps the instant before London midnight in the previous month", () => {
    const august = londonMonthBounds(2026, 8);
    const september = londonMonthBounds(2026, 9);
    const justBefore = "2026-08-31T22:59:00.000Z";
    const onTheHour = "2026-08-31T23:00:00.000Z";

    expect(inLondonRange(justBefore, august.start, august.end)).toBe(true);
    expect(inLondonRange(justBefore, september.start, september.end)).toBe(false);
    expect(inLondonRange(onTheHour, august.start, august.end)).toBe(false);
    expect(inLondonRange(onTheHour, september.start, september.end)).toBe(true);
  });

  it("excludes the next London midnight from the month", () => {
    const september = londonMonthBounds(2026, 9);
    const october = londonMonthBounds(2026, 10);
    const boundary = "2026-09-30T23:00:00.000Z";
    expect(inLondonRange(boundary, september.start, september.end)).toBe(false);
    expect(inLondonRange(boundary, october.start, october.end)).toBe(true);
    expect(inLondonRange("2026-09-30T22:59:00.000Z", september.start, september.end)).toBe(
      true
    );
  });

  it("does not pull a January GMT instant into December", () => {
    const december = londonMonthBounds(2025, 12);
    const january = londonMonthBounds(2026, 1);
    const newYear = "2026-01-01T00:00:00.000Z";
    expect(inLondonRange(newYear, december.start, december.end)).toBe(false);
    expect(inLondonRange(newYear, january.start, january.end)).toBe(true);
    expect(inLondonRange("2025-12-31T23:59:00.000Z", january.start, january.end)).toBe(
      false
    );
  });

  it("parses YYYY-MM and falls back to the London month", () => {
    expect(parseStatementMonth("2026-09")).toEqual({
      year: 2026,
      month: 9,
      key: "2026-09",
    });
    expect(parseStatementMonth("2026-13").key).toMatch(/^\d{4}-\d{2}$/);
    const london = parseStatementMonth(undefined, new Date("2026-08-31T23:30:00.000Z"));
    expect(london).toEqual({ year: 2026, month: 9, key: "2026-09" });
    const winter = parseStatementMonth("nope", new Date("2026-01-01T00:30:00.000Z"));
    expect(winter).toEqual({ year: 2026, month: 1, key: "2026-01" });
  });
});

describe("fee settlement", () => {
  it("puts 15% commission on the platform and the rest on the Connected Account", () => {
    const settled = settleBookingFees(booking());
    expect(settled.grossConsultCents).toBe(4000);
    expect(settled.platformFeeCents).toBe(600);
    expect(settled.connectedAccountCents).toBe(3400);
    expect(settled.stripeChargeCents).toBe(4000);
    expect(settled.settlement).toBe("destination_charge");
  });

  it("includes a legacy platform_fee_cents in the platform share", () => {
    const settled = settleBookingFees(
      booking({ platformFeeCents: 100, commissionCents: 600 })
    );
    expect(settled.platformFeeCents).toBe(700);
    expect(settled.connectedAccountCents).toBe(3300);
  });

  it("caps the application fee at the deposit that was actually charged", () => {
    const settled = settleBookingFees(
      booking({
        paymentMode: "deposit",
        consultationFeeCents: 10000,
        totalAmountCents: 10000,
        commissionCents: getCommissionCents(10000),
        depositAmountCents: 3000,
      })
    );
    expect(settled.grossConsultCents).toBe(10000);
    expect(settled.stripeChargeCents).toBe(3000);
    expect(settled.platformFeeCents).toBe(1500);
    expect(settled.connectedAccountCents).toBe(1500);
  });

  it("does not transfer wallet credit onto the Connected Account", () => {
    const settled = settleBookingFees(
      booking({ walletCreditAppliedCents: 1000, commissionCents: 600 })
    );
    expect(settled.stripeChargeCents).toBe(3000);
    expect(settled.platformFeeCents).toBe(600);
    expect(settled.connectedAccountCents).toBe(2400);
  });

  it("caps the application fee when wallet credit leaves less than the commission", () => {
    const settled = settleBookingFees(
      booking({
        paymentMode: "deposit",
        consultationFeeCents: 10000,
        totalAmountCents: 10000,
        commissionCents: 1500,
        depositAmountCents: 3000,
        walletCreditAppliedCents: 2000,
      })
    );
    expect(settled.stripeChargeCents).toBe(1000);
    expect(settled.platformFeeCents).toBe(1000);
    expect(settled.connectedAccountCents).toBe(0);
  });

  it("uses the 15% checkout fallback when a PaymentIntent exists but commission was not stored", () => {
    const settled = settleBookingFees(
      booking({
        commissionCents: 0,
        platformFeeCents: 0,
        consultationFeeCents: 4000,
        totalAmountCents: 10000,
      })
    );
    expect(settled.grossConsultCents).toBe(10000);
    expect(settled.platformFeeCents).toBe(getCommissionCents(10000));
    expect(settled.connectedAccountCents).toBe(10000 - getCommissionCents(10000));
  });

  it("does not invent a platform fee when no destination charge exists", () => {
    const settled = settleBookingFees(
      booking({ stripePaymentIntentId: null, commissionCents: 600 })
    );
    expect(settled.settlement).toBe("no_destination_charge");
    expect(settled.platformFeeCents).toBe(0);
    expect(settled.connectedAccountCents).toBe(0);
    expect(settled.grossConsultCents).toBe(4000);
  });

  it("zeroes a paid dearer-slot reschedule successor", () => {
    const settled = settleBookingFees(
      booking({
        rescheduledFromBookingId: "booking-original",
        reschedulePaymentStatus: "paid",
        reschedulePriceDiffCents: 1500,
        totalAmountCents: 5500,
        consultationFeeCents: 5500,
        commissionCents: 0,
      })
    );
    expect(settled.settlement).toBe("reschedule_platform_charge");
    expect(settled.grossConsultCents).toBe(0);
    expect(settled.connectedAccountCents).toBe(0);
    expect(settled.platformFeeCents).toBe(0);
  });

  it("keeps the destination charge on a same-or-cheaper reschedule", () => {
    const settled = settleBookingFees(
      booking({
        rescheduledFromBookingId: "booking-original",
        reschedulePaymentStatus: "not_required",
        reschedulePriceDiffCents: -500,
      })
    );
    expect(settled.settlement).toBe("destination_charge");
    expect(settled.connectedAccountCents).toBe(3400);
    expect(settled.grossConsultCents).toBe(4000);
  });
});

describe("refunds", () => {
  it("returns the platform fee and reverses the transfer on a full refund", () => {
    const settlement = settleBookingFees(booking());
    const refund = allocateRefund(settlement, 4000);
    expect(refund.platformFeeReturnedCents).toBe(600);
    expect(refund.transferReversedCents).toBe(3400);
  });

  it("splits a partial refund in proportion to the charge", () => {
    const settlement = settleBookingFees(booking());
    const refund = allocateRefund(settlement, 2000);
    expect(refund.platformFeeReturnedCents).toBe(300);
    expect(refund.transferReversedCents).toBe(1700);
  });
});

describe("buildActivityStatement", () => {
  const now = new Date("2026-09-26T12:00:00.000Z");

  it("totals a paid booking in the London month", () => {
    const statement = buildActivityStatement({
      year: 2026,
      month: 9,
      bookings: [booking()],
      payeeName: "Dr Vera Softsmoke",
      scopeLabel: "This doctor",
      now,
      fallbackCurrency: "GBP",
    });

    expect(statement.title).toBe(ACTIVITY_STATEMENT_TITLE);
    expect(statement.periodLabel).toBe("September 2026");
    expect(statement.lines).toHaveLength(1);
    expect(statement.lines[0]).toMatchObject({
      kind: "booking",
      dateLabel: "Saturday 26 September 2026, 9:00am BST",
      patientLabel: "Amelia C.",
      serviceLabel: "Video consultation",
      appointmentLabel: "Saturday 26 September 2026, 9:00am",
      statusLabel: "Confirmed",
      connectedAccountCents: 3400,
      platformFeeCents: 600,
      refundAmountCents: 0,
      grossConsultCents: 4000,
    });
    expect(statement.lines[0]?.patientLabel).not.toContain("Chen");
    expect(statement.totals).toEqual([
      {
        currency: "GBP",
        bookingsCount: 1,
        grossConsultCents: 4000,
        refundsCents: 0,
        platformFeeCents: 600,
        netConnectedAccountCents: 3400,
      },
    ]);
    expect(formatStatementMoney(4000, "GBP")).toBe("£40.00");
    expect(formatStatementMoney(3400, "GBP")).toBe("£34.00");
    expect(formatStatementMoney(-600, "GBP")).toBe("\u2212£6.00");
  });

  it("places a payment just after London midnight in September, not August", () => {
    const paidAt = "2026-08-31T23:30:00.000Z";
    const source = booking({ paidAt, bookingNumber: "BK-BOUNDARY" });
    const september = buildActivityStatement({
      year: 2026,
      month: 9,
      bookings: [source],
      payeeName: "Dr Vera Softsmoke",
      scopeLabel: "This doctor",
      now,
    });
    const august = buildActivityStatement({
      year: 2026,
      month: 8,
      bookings: [source],
      payeeName: "Dr Vera Softsmoke",
      scopeLabel: "This doctor",
      now,
    });

    expect(september.lines).toHaveLength(1);
    expect(september.lines[0]?.dateLabel).toBe(
      formatEmailDateTime(paidAt, "Europe/London")
    );
    expect(september.lines[0]?.dateLabel).toBe("Tuesday 1 September 2026, 12:30am BST");
    expect(august.lines).toHaveLength(0);
    expect(august.totals[0]?.bookingsCount).toBe(0);
  });

  it("shows a same-month full refund as its own line and nets the Connected Account to zero", () => {
    const statement = buildActivityStatement({
      year: 2026,
      month: 9,
      bookings: [
        booking({
          status: "refunded",
          refundAmountCents: 4000,
          refundedAt: "2026-09-28T15:00:00.000Z",
        }),
      ],
      payeeName: "Dr Vera Softsmoke",
      scopeLabel: "This doctor",
      now,
    });

    expect(statement.lines.map((line) => line.kind)).toEqual(["booking", "refund"]);
    expect(statement.lines[1]).toMatchObject({
      statusLabel: "Refund",
      refundAmountCents: 4000,
      platformFeeCents: -600,
      connectedAccountCents: -3400,
      grossConsultCents: 0,
    });
    expect(statement.totals[0]).toMatchObject({
      bookingsCount: 1,
      grossConsultCents: 4000,
      refundsCents: 4000,
      platformFeeCents: 0,
      netConnectedAccountCents: 0,
    });
  });

  it("keeps a later-month refund out of the payment month", () => {
    const source = booking({
      paidAt: "2026-09-26T08:00:00.000Z",
      refundedAt: "2026-10-02T09:00:00.000Z",
      refundAmountCents: 2000,
      status: "cancelled_patient",
    });
    const september = buildActivityStatement({
      year: 2026,
      month: 9,
      bookings: [source],
      payeeName: "Dr Vera Softsmoke",
      scopeLabel: "This doctor",
      now,
    });
    const october = buildActivityStatement({
      year: 2026,
      month: 10,
      bookings: [source],
      payeeName: "Dr Vera Softsmoke",
      scopeLabel: "This doctor",
      now,
    });

    expect(september.lines).toHaveLength(1);
    expect(september.totals[0]).toMatchObject({
      bookingsCount: 1,
      refundsCents: 0,
      platformFeeCents: 600,
      netConnectedAccountCents: 3400,
    });
    expect(october.lines).toHaveLength(1);
    expect(october.lines[0]?.kind).toBe("refund");
    expect(october.totals[0]).toMatchObject({
      bookingsCount: 0,
      grossConsultCents: 0,
      refundsCents: 2000,
      platformFeeCents: -300,
      netConnectedAccountCents: -1700,
    });
  });

  it("counts the original destination charge once when a dearer slot is rescheduled", () => {
    const original = booking({
      id: "booking-original",
      bookingNumber: "BK-100",
      status: "cancelled_doctor",
      paidAt: "2026-09-10T09:00:00.000Z",
      stripePaymentIntentId: "pi_original",
    });
    const successor = booking({
      id: "booking-successor",
      bookingNumber: "BK-100-R",
      status: "confirmed",
      paidAt: "2026-09-12T09:00:00.000Z",
      consultationFeeCents: 5500,
      totalAmountCents: 5500,
      commissionCents: 0,
      platformFeeCents: 0,
      reschedulePriceDiffCents: 1500,
      reschedulePaymentStatus: "paid",
      rescheduledFromBookingId: "booking-original",
      stripePaymentIntentId: "pi_balance",
    });
    const statement = buildActivityStatement({
      year: 2026,
      month: 9,
      bookings: [successor, original],
      payeeName: "Dr Vera Softsmoke",
      scopeLabel: "This doctor",
      now,
    });

    expect(statement.lines).toHaveLength(2);
    expect(statement.lines.find((line) => line.bookingNumber === "BK-100")).toMatchObject({
      statusLabel: "Rescheduled to BK-100-R",
      grossConsultCents: 4000,
      platformFeeCents: 600,
      connectedAccountCents: 3400,
    });
    expect(statement.lines.find((line) => line.bookingNumber === "BK-100-R")).toMatchObject({
      statusLabel: RESCHEDULE_BALANCE_LABEL,
      grossConsultCents: 0,
      platformFeeCents: 0,
      connectedAccountCents: 0,
      refundAmountCents: 0,
    });
    expect(statement.totals[0]).toMatchObject({
      bookingsCount: 1,
      grossConsultCents: 4000,
      refundsCents: 0,
      platformFeeCents: 600,
      netConnectedAccountCents: 3400,
    });
  });

  it("shows a patient name only for the viewing doctor's own bookings", () => {
    const statement = buildActivityStatement({
      year: 2026,
      month: 9,
      viewerDoctorId: "doctor-viewer",
      bookings: [
        booking({
          doctorId: "doctor-viewer",
          bookingNumber: "BK-MINE",
          patientFirstName: "Amelia",
          patientLastName: "Chen",
        }),
        booking({
          doctorId: "doctor-colleague",
          bookingNumber: "BK-OTHER",
          patientFirstName: "Amelia",
          patientLastName: "Chen",
        }),
      ],
      payeeName: "Softsmoke Clinic",
      scopeLabel: "This clinic",
      now,
    });

    expect(statement.lines.find((line) => line.bookingNumber === "BK-MINE")?.patientLabel).toBe(
      "Amelia C."
    );
    const other = statement.lines.find((line) => line.bookingNumber === "BK-OTHER");
    expect(other?.patientLabel).toBe("BK-OTHER");
    expect(other?.patientLabel).not.toContain("Chen");
    expect(other?.patientLabel).not.toContain("Amelia");
  });

  it("uses the booking reference when the patient name is missing", () => {
    expect(statementPatientLabel(null, null, "BK-1")).toBe("BK-1");
    expect(statementPatientLabel("Amelia", null, "BK-1")).toBe("Amelia");
    const statement = buildActivityStatement({
      year: 2026,
      month: 9,
      bookings: [booking({ patientFirstName: null, patientLastName: "  " })],
      payeeName: "Dr Vera Softsmoke",
      scopeLabel: "This doctor",
      now,
    });
    expect(statement.lines[0]?.patientLabel).toBe("BK-20260926-TEST");
  });

  it("does not put clinical fields in the select list", () => {
    const select = activityStatementSelect(true);
    assertActivityStatementSelectIsSafe(select);
    for (const field of FORBIDDEN) {
      expect(select.toLowerCase()).not.toContain(field);
    }
    expect(select).toContain("first_name, last_name");
    expect(select).toContain("doctor_id");
    expect(select).toContain("rescheduled_from_booking_id");
    expect(select).toContain("reschedule_payment_status");
    expect(select).not.toContain("email");
  });
});

describe("navigation gating", () => {
  it("does not add the statement to the default doctor navigation", () => {
    const hrefs = [
      ...doctorSidebarLinks.map((link) => link.href),
      ...doctorSidebarGroups.flatMap((group) => group.links.map((link) => link.href)),
    ];
    expect(hrefs).not.toContain(ACTIVITY_STATEMENT_HREF);
  });

  it("inserts the statement after Payments only when asked", () => {
    const links = withActivityStatementLink(doctorSidebarLinks);
    const payments = links.findIndex((link) => link.href === "/doctor-dashboard/payments");
    expect(links[payments + 1]?.href).toBe(ACTIVITY_STATEMENT_HREF);
    expect(links[payments + 1]?.label).toBe("Activity statement");
  });
});

describe("rendered statement", () => {
  it("downloads as an activity statement with minimal patient identity and GBP amounts", () => {
    const statement = buildActivityStatement({
      year: 2026,
      month: 9,
      bookings: [
        booking({
          patientFirstName: "Amelia",
          patientLastName: "Chen",
          serviceName: "Follow-up",
        }),
      ],
      payeeName: "Dr Vera Softsmoke",
      scopeLabel: "This doctor",
      now: new Date("2026-09-26T12:00:00.000Z"),
    });
    const html = renderActivityStatementHtml(statement);
    expect(html).toContain("MyDoctors360 activity statement");
    expect(html).toContain(ACTIVITY_STATEMENT_FOOTER);
    expect(html).toContain("£40.00");
    expect(html).toContain("£34.00");
    expect(html).toContain("£6.00");
    expect(html).toContain("Amelia C.");
    expect(html).toContain("BK-20260926-TEST");
    expect(html).toContain("Follow-up");
    expect(html).not.toContain("Chen");
    expect(html.toLowerCase()).not.toMatch(/\binvoice\b|\breceipt\b/);
    expect(html).not.toMatch(/patient_notes|doctor_notes|visit_summary/);
    expect(html).toContain('<span class="d">Saturday 26 September 2026</span><span class="t">9:00am BST</span>');
    expect(html).toContain("max-width: 860px");
    expect(html).toContain('<table class="lines__table">');
    expect(html).toContain('<div class="brand">');
    expect(html).toContain('<div class="foot">');
    expect(html).not.toMatch(/<header[\s>]/);
    expect(html).not.toMatch(/<footer[\s>]/);
    expect(html).toContain("print-color-adjust: exact !important");
    expect(html).toContain("background-color: #0B6BCB !important");
    expect(html).toContain("background-color: #f3f4f6 !important");
    expect(html).toContain("background-color: #f9fafb !important");
    expect(html).toContain(".col-action { display: none !important");
    expect(html).not.toMatch(/<button/i);
    expect(html.toLowerCase()).not.toMatch(/\bbill\b/);
  });
});

describe("data access", () => {
  it("reads bookings with the user session, not the service role", () => {
    const access = readFileSync(
      join(process.cwd(), "src/lib/statements/access.ts"),
      "utf8"
    );
    const route = readFileSync(
      join(process.cwd(), "src/app/api/doctor/activity-statement/route.ts"),
      "utf8"
    );
    const page = readFileSync(
      join(
        process.cwd(),
        "src/app/[locale]/(doctor)/doctor-dashboard/activity-statement/page.tsx"
      ),
      "utf8"
    );
    for (const source of [access, route, page]) {
      expect(source).not.toContain("createAdminClient");
      expect(source).not.toContain("service_role");
    }
    expect(access).toContain("isSoftLaunchSoftsmokeDoctor");
    expect(access).toContain('.eq("doctor_id"');
    expect(access).toContain("viewerDoctorId: viewer.doctorId");

    const layout = readFileSync(
      join(process.cwd(), "src/app/[locale]/(doctor)/layout.tsx"),
      "utf8"
    );
    expect(layout).toContain("canShowActivityStatementNav");
    expect(layout).not.toContain("canViewActivityStatement");
    const navGate = access.slice(
      access.indexOf("export async function canShowActivityStatementNav"),
      access.indexOf("export async function getActivityStatementViewer")
    );
    expect(navGate).toContain("getActivityStatementDoctor");
    expect(navGate).not.toContain("organization_members");
    expect(access.slice(access.indexOf("export async function getActivityStatementViewer"))).toContain(
      "organization_members"
    );
  });
});

describe("money formatting", () => {
  it("uses a minus sign for negative amounts", () => {
    expect(formatStatementMoney(-3400, "GBP")).toBe("\u2212£34.00");
    expect(formatStatementMoney(-3400, "GBP").includes("-")).toBe(false);
    expect(formatStatementMoney(0, "GBP")).toBe("£0.00");
    expect(formatStatementMoney(-100, "EUR")).toBe("\u2212EUR 1.00");
  });
});

describe("copy lock", () => {
  it("names the document an activity statement and keeps the records-only footer", () => {
    expect(ACTIVITY_STATEMENT_TITLE).toBe("MyDoctors360 activity statement");
    expect(ACTIVITY_STATEMENT_FOOTER).toBe(
      "Consultation fees are paid directly to your Stripe Connected Account. MyDoctors360 charges a platform fee for bookings made through the marketplace. This activity statement is for your records only."
    );
    expect(ACTIVITY_STATEMENT_FOOTER).toContain("Stripe Connected Account");
    expect(ACTIVITY_STATEMENT_FOOTER).toContain("platform fee");
    expect(ACTIVITY_STATEMENT_FOOTER).toContain("for your records only");
    expect(`${ACTIVITY_STATEMENT_TITLE} ${ACTIVITY_STATEMENT_FOOTER}`.toLowerCase()).not.toMatch(
      /\binvoice\b|\breceipt\b/
    );
  });
});
