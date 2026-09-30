import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { log } from "@/lib/utils/logger";
import {
  STRIPE_REFUND_BOOKING_NOT_UPDATED,
  bookingRowUpdateError,
} from "@/lib/booking/booking-row-update";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("bookingRowUpdateError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("treats a zero-row update after a Stripe refund as an error", () => {
    const errorLog = vi.spyOn(log, "error").mockImplementation(() => {});

    const result = bookingRowUpdateError({
      error: null,
      rows: [],
      stripeRefundSucceeded: true,
      bookingId: "book-1",
      stripeRefundId: "re_1500",
    });

    expect(result).toEqual({ error: STRIPE_REFUND_BOOKING_NOT_UPDATED });
    expect(result?.error).toMatch(/Stripe refund succeeded/i);
    expect(result?.error).toMatch(/booking record was not updated/i);
    expect(errorLog).toHaveBeenCalledWith(
      "Stripe refund succeeded but the booking row was not updated",
      expect.objectContaining({
        bookingId: "book-1",
        stripeRefundId: "re_1500",
        rowsUpdated: 0,
      })
    );
  });

  it("uses the same Stripe mismatch message when the update returns an error", () => {
    vi.spyOn(log, "error").mockImplementation(() => {});

    const result = bookingRowUpdateError({
      error: { message: "connection reset" },
      rows: null,
      stripeRefundSucceeded: true,
      bookingId: "book-1",
      stripeRefundId: "re_4000",
    });

    expect(result).toEqual({ error: STRIPE_REFUND_BOOKING_NOT_UPDATED });
  });

  it("returns null when a row was updated", () => {
    const errorLog = vi.spyOn(log, "error").mockImplementation(() => {});

    expect(
      bookingRowUpdateError({
        error: null,
        rows: [{ id: "book-1" }],
        stripeRefundSucceeded: true,
        bookingId: "book-1",
        stripeRefundId: "re_1",
      })
    ).toBeNull();
    expect(errorLog).not.toHaveBeenCalled();
  });
});

describe("admin refund and cancel booking writes", () => {
  const source = read("src/actions/admin.ts");
  const refund = source.slice(
    source.indexOf("export async function adminRefundBooking"),
    source.indexOf("export async function adminUpdateBookingStatus")
  );
  const cancel = source.slice(
    source.indexOf("export async function adminCancelBooking"),
    source.indexOf("export async function adminGetCancelPreview")
  );

  it("writes the refund through the shared recorder, not the admin session", () => {
    expect(refund).toContain("recordConsultRefundOnBooking");
    expect(refund).toContain("markStatusRefunded: true");
    expect(refund).not.toMatch(
      /await supabase\s*\.from\("bookings"\)\s*\.update/
    );
    const recorder = read("src/lib/stripe/record-consult-refund.ts");
    expect(recorder).toContain("createAdminClient()");
    expect(recorder).toContain('.select("id")');
    expect(recorder).toContain("bookingRowUpdateError");
    expect(recorder).toContain("stripeRefundSucceeded: true");
  });

  it("records an admin cancel through the shared recorder", () => {
    expect(cancel).toContain("createAdminClient()");
    expect(cancel).toContain("recordConsultRefundOnBooking");
    expect(cancel).toContain("BOOKING_STATUSES.CANCELLED_DOCTOR");
  });
});
