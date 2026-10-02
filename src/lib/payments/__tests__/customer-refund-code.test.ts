import { describe, expect, it } from "vitest";
import {
  assignCustomerRefundCode,
  customerRefundCodeForBooking,
  displayRefundReference,
} from "@/lib/payments/customer-refund-code";

describe("customer refund codes", () => {
  it("uses RF- plus the booking ref without the MD- prefix", () => {
    expect(customerRefundCodeForBooking("MD-TT9EJN")).toBe("RF-TT9EJN");
    expect(customerRefundCodeForBooking("md-tt9ejn")).toBe("RF-TT9EJN");
    expect(customerRefundCodeForBooking("MD-TT9EJN-R")).toBe("RF-TT9EJN-R");
    expect(customerRefundCodeForBooking("BK-20260926-2FB5")).toBe(
      "RF-BK-20260926-2FB5"
    );
  });

  it("stores the full Stripe refund id beside a stable short code", () => {
    const stripeId = "re_3UM5aiPhJvj3ftQe09C2DMhs";
    const first = assignCustomerRefundCode({
      bookingNumber: "MD-TT9EJN",
      existing: [],
      stripeRefundId: stripeId,
      amountCents: 4900,
      now: "2026-10-02T15:17:00.000Z",
    })!;
    expect(first.code).toBe("RF-TT9EJN");
    expect(first.codes[0].stripe_refund_id).toBe(stripeId);

    const replay = assignCustomerRefundCode({
      bookingNumber: "MD-TT9EJN",
      existing: first.codes,
      stripeRefundId: stripeId,
      amountCents: 4900,
    })!;
    expect(replay.code).toBe("RF-TT9EJN");
    expect(replay.codes).toHaveLength(1);

    const second = assignCustomerRefundCode({
      bookingNumber: "MD-TT9EJN",
      existing: first.codes,
      stripeRefundId: "re_another",
      amountCents: 1000,
    })!;
    expect(second.code).toBe("RF-TT9EJN-2");
    expect(second.codes[1].stripe_refund_id).toBe("re_another");
  });

  it("does not print a Stripe refund id in the email reference", () => {
    expect(
      displayRefundReference("re_3UM5aiPhJvj3ftQe09C2DMhs", "MD-TT9EJN")
    ).toBe("RF-TT9EJN");
    expect(displayRefundReference("RF-TT9EJN-2", "MD-TT9EJN")).toBe(
      "RF-TT9EJN-2"
    );
  });
});
