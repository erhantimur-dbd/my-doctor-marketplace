import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  adminDoctorPayoutCents,
  formatAdminBookingTime,
  resolveAdminPlatformFeeCents,
  sumRecordedPlatformFees,
} from "@/lib/booking/admin-booking-display";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("formatAdminBookingTime", () => {
  it("renders a timestamptz start and end in Europe/London", () => {
    expect(
      formatAdminBookingTime(
        "2026-09-27T09:30:00+00:00",
        "2026-09-27T10:00:00+00:00"
      )
    ).toBe("Sunday 27 September, 10:30 to 11:00 (UK time)");
  });

  it("treats wall-clock times as London time on the appointment date", () => {
    expect(
      formatAdminBookingTime("10:30:00", "11:00:00", "2026-09-27")
    ).toBe("Sunday 27 September, 10:30 to 11:00 (UK time)");
  });
});

describe("admin platform fee", () => {
  it("uses commission_cents for a £40 booking whose platform_fee_cents is empty", () => {
    const fee = resolveAdminPlatformFeeCents({
      commissionCents: 600,
      platformFeeCents: null,
    });
    expect(fee).toBe(600);
    expect(adminDoctorPayoutCents(4000, fee)).toBe(3400);
  });

  it("falls back to platform_fee_cents, then the platform_fees ledger", () => {
    expect(
      resolveAdminPlatformFeeCents({
        commissionCents: 0,
        platformFeeCents: 600,
      })
    ).toBe(600);
    expect(
      resolveAdminPlatformFeeCents({
        commissionCents: null,
        platformFeeCents: null,
        recordedFeeCents: sumRecordedPlatformFees([{ amount_cents: 600 }]),
      })
    ).toBe(600);
  });
});

describe("admin booking pages", () => {
  const list = read("src/app/[locale]/(admin)/admin/bookings/page.tsx");
  const detail = read("src/app/[locale]/(admin)/admin/bookings/[id]/page.tsx");

  it("formats start and end with the UK window on the list and the detail page", () => {
    expect(list).toContain("formatAdminBookingTime");
    expect(list).toContain("booking.end_time");
    expect(detail).toContain("formatAdminBookingTime");
    expect(list).not.toContain("start_time?.slice(0, 5)");
    expect(detail).not.toContain("start_time?.slice(0, 5)");
    expect(detail).not.toContain("end_time?.slice(0, 5)");
  });

  it("derives platform fee and doctor payout from the resolved fee", () => {
    expect(detail).toContain("resolveAdminPlatformFeeCents");
    expect(detail).toContain("adminDoctorPayoutCents");
    expect(detail).toContain('from("platform_fees")');
    expect(detail).not.toContain(
      "booking.total_amount_cents - booking.platform_fee_cents"
    );
  });
});
