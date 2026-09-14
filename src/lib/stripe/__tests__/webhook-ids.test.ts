import { describe, expect, it } from "vitest";
import {
  bookingIdFromCheckoutMetadata,
  deauthorizedConnectedAccountId,
} from "@/lib/stripe/webhook-ids";

describe("bookingIdFromCheckoutMetadata", () => {
  it("prefers booking_id then first_booking_id", () => {
    expect(
      bookingIdFromCheckoutMetadata({
        booking_id: "b1",
        first_booking_id: "b0",
      })
    ).toBe("b1");
    expect(
      bookingIdFromCheckoutMetadata({
        treatment_plan_id: "tp1",
        first_booking_id: "b0",
      })
    ).toBe("b0");
    expect(bookingIdFromCheckoutMetadata({ treatment_plan_id: "tp1" })).toBe(
      undefined
    );
  });
});

describe("deauthorizedConnectedAccountId", () => {
  it("uses event.account, not the application object id", () => {
    expect(
      deauthorizedConnectedAccountId({
        account: "acct_connected",
        data: { object: { id: "ca_application" } },
      })
    ).toBe("acct_connected");
    expect(
      deauthorizedConnectedAccountId({
        data: { object: { id: "ca_application" } },
      })
    ).toBeUndefined();
  });
});
