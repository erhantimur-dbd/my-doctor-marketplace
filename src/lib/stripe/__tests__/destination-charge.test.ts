import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  bookingDestinationChargePatch,
  destinationChargeIdsFromPaymentIntent,
  loadDestinationChargeIds,
  persistBookingDestinationChargeIds,
} from "@/lib/stripe/destination-charge";
import { resolveDestinationTransfer } from "@/lib/stripe/transfer-handoff";

const CHARGE_ID = "ch_3ULNGRPhJvj3ftQe0DwVQ9cq";
const TRANSFER_ID = "tr_3ULNGRPhJvj3ftQe024gvyCO";

describe("destination charge ids", () => {
  it("reads latest_charge and the expanded destination transfer", () => {
    expect(
      destinationChargeIdsFromPaymentIntent({
        latest_charge: {
          id: CHARGE_ID,
          transfer: { id: TRANSFER_ID },
        },
      })
    ).toEqual({ chargeId: CHARGE_ID, transferId: TRANSFER_ID });
  });

  it("keeps an unexpanded charge id and leaves the transfer empty", () => {
    expect(
      destinationChargeIdsFromPaymentIntent({ latest_charge: CHARGE_ID })
    ).toEqual({ chargeId: CHARGE_ID, transferId: null });
  });

  it("returns nothing when the payment intent has no charge", () => {
    expect(destinationChargeIdsFromPaymentIntent({})).toEqual({
      chargeId: null,
      transferId: null,
    });
    expect(
      destinationChargeIdsFromPaymentIntent({ latest_charge: null })
    ).toEqual({ chargeId: null, transferId: null });
  });

  it("expands latest_charge and its transfer when loading from Stripe", async () => {
    const retrieve = vi.fn().mockResolvedValue({
      latest_charge: { id: CHARGE_ID, transfer: TRANSFER_ID },
    });
    const ids = await loadDestinationChargeIds("pi_test", {
      paymentIntents: { retrieve },
    });
    expect(retrieve).toHaveBeenCalledWith("pi_test", {
      expand: ["latest_charge", "latest_charge.transfer"],
    });
    expect(ids).toEqual({ chargeId: CHARGE_ID, transferId: TRANSFER_ID });
  });

  it("fills only missing booking columns", () => {
    expect(
      bookingDestinationChargePatch({
        existingChargeId: null,
        existingTransferId: null,
        chargeId: CHARGE_ID,
        transferId: TRANSFER_ID,
      })
    ).toEqual({
      stripe_charge_id: CHARGE_ID,
      stripe_destination_transfer_id: TRANSFER_ID,
    });

    expect(
      bookingDestinationChargePatch({
        existingChargeId: CHARGE_ID,
        existingTransferId: "tr_existing",
        chargeId: "ch_other",
        transferId: TRANSFER_ID,
      })
    ).toBeNull();

    expect(
      bookingDestinationChargePatch({
        existingChargeId: CHARGE_ID,
        existingTransferId: null,
        chargeId: "ch_other",
        transferId: TRANSFER_ID,
      })
    ).toEqual({ stripe_destination_transfer_id: TRANSFER_ID });
  });
});

describe("persistBookingDestinationChargeIds", () => {
  function fakeSupabase(row: {
    stripe_charge_id?: string | null;
    stripe_destination_transfer_id?: string | null;
  }) {
    const updates: Record<string, unknown>[] = [];
    const client = {
      updates,
      from() {
        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          maybeSingle: async () => ({ data: row, error: null }),
          update(payload: Record<string, unknown>) {
            updates.push(payload);
            return builder;
          },
          then(resolve: (value: unknown) => void) {
            resolve({ data: null, error: null });
          },
        };
        return builder;
      },
    };
    return client;
  }

  it("stores both ids from the expanded payment intent", async () => {
    const client = fakeSupabase({
      stripe_charge_id: null,
      stripe_destination_transfer_id: null,
    });
    await persistBookingDestinationChargeIds({
      bookingId: "bk-1",
      paymentIntentId: "pi_test",
      supabase: client as unknown as SupabaseClient,
      stripe: {
        paymentIntents: {
          retrieve: async () => ({
            latest_charge: { id: CHARGE_ID, transfer: { id: TRANSFER_ID } },
          }),
        },
      },
    });
    expect(client.updates).toEqual([
      {
        stripe_charge_id: CHARGE_ID,
        stripe_destination_transfer_id: TRANSFER_ID,
      },
    ]);
  });

  it("does not call Stripe when both ids are already stored", async () => {
    const client = fakeSupabase({
      stripe_charge_id: CHARGE_ID,
      stripe_destination_transfer_id: TRANSFER_ID,
    });
    const retrieve = vi.fn();
    await persistBookingDestinationChargeIds({
      bookingId: "bk-1",
      paymentIntentId: "pi_test",
      supabase: client as unknown as SupabaseClient,
      stripe: { paymentIntents: { retrieve } },
    });
    expect(retrieve).not.toHaveBeenCalled();
    expect(client.updates).toEqual([]);
  });

  it("skips charge-skip and £0 bookings that have no payment intent", async () => {
    const client = fakeSupabase({});
    const retrieve = vi.fn();
    await persistBookingDestinationChargeIds({
      bookingId: "bk-1",
      paymentIntentId: null,
      supabase: client as unknown as SupabaseClient,
      stripe: { paymentIntents: { retrieve } },
    });
    expect(retrieve).not.toHaveBeenCalled();
    expect(client.updates).toEqual([]);
  });
});

describe("resolveDestinationTransfer", () => {
  it("uses the stored transfer id and does not search the payment intent", async () => {
    const found = await resolveDestinationTransfer({
      paymentIntentId: "pi_test",
      storedTransferId: TRANSFER_ID,
      retrieveTransfer: async (id) => ({
        id,
        amount: 8500,
        currency: "gbp",
      }),
      findTransfer: async () => {
        throw new Error("should not search");
      },
    });
    expect(found).toEqual({
      transferId: TRANSFER_ID,
      amount: 8500,
      currency: "gbp",
    });
  });

  it("falls back to the payment intent when the stored transfer is already reversed", async () => {
    const found = await resolveDestinationTransfer({
      paymentIntentId: "pi_test",
      storedTransferId: TRANSFER_ID,
      retrieveTransfer: async () => ({
        id: TRANSFER_ID,
        amount: 8500,
        currency: "gbp",
        reversed: true,
      }),
      findTransfer: async () => ({
        transferId: "tr_current",
        amount: 4000,
        currency: "gbp",
      }),
    });
    expect(found).toEqual({
      transferId: "tr_current",
      amount: 4000,
      currency: "gbp",
    });
  });
});
