import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import * as emailClient from "@/lib/email/client";
import { transferReversalRecord } from "@/lib/stripe/connect-event-handlers";
import type Stripe from "stripe";

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  client: null as null | {
    from: (table: string) => unknown;
    tables: Record<string, Row[]>;
  },
  constructEvent: null as
    | null
    | ((payload: string, signature: string, secret: string) => Stripe.Event),
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: (payload: string, signature: string, secret: string) => {
        if (!state.constructEvent) throw new Error("constructEvent unset");
        return state.constructEvent(payload, signature, secret);
      },
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    if (!state.client) throw new Error("supabase unset");
    return state.client;
  },
}));

const PLATFORM_SECRET = "whsec_platform_test";
const CONNECT_SECRET = "whsec_connect_test";

function createMemorySupabase(seed: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(seed)) {
    tables[name] = rows.map((row) => ({ ...row }));
  }
  const ensure = (name: string) => {
    if (!tables[name]) tables[name] = [];
    return tables[name];
  };

  function from(table: string) {
    const query = {
      op: "select" as "select" | "insert" | "update" | "delete",
      filters: [] as { col: string; val: unknown }[],
      payload: null as Row | null,
      single: false,
    };
    const api = {
      select() {
        return api;
      },
      insert(payload: Row) {
        query.op = "insert";
        query.payload = payload;
        return api;
      },
      update(payload: Row) {
        query.op = "update";
        query.payload = payload;
        return api;
      },
      delete() {
        query.op = "delete";
        return api;
      },
      eq(col: string, val: unknown) {
        query.filters.push({ col, val });
        return api;
      },
      order() {
        return api;
      },
      limit() {
        return api;
      },
      maybeSingle() {
        query.single = true;
        return api;
      },
      then(
        resolve: (value: { data: unknown; error: { code?: string; message: string } | null }) => unknown,
        reject?: (reason: unknown) => unknown
      ) {
        return Promise.resolve(execute()).then(resolve, reject);
      },
    };

    function matches(row: Row) {
      return query.filters.every((filter) => row[filter.col] === filter.val);
    }

    function execute() {
      const rows = ensure(table);
      if (query.op === "insert") {
        const payload = query.payload || {};
        const duplicateEvent =
          table === "processed_webhook_events" &&
          rows.some((row) => row.event_id === payload.event_id);
        const duplicateAudit =
          table === "stripe_transfer_reversal_audits" &&
          rows.some(
            (row) =>
              row.stripe_event_id === payload.stripe_event_id &&
              row.match_kind === payload.match_kind
          );
        if (duplicateEvent || duplicateAudit) {
          return { data: null, error: { code: "23505", message: "duplicate" } };
        }
        rows.push({ ...payload });
        return { data: null, error: null };
      }
      const matched = rows.filter(matches);
      if (query.op === "delete") {
        tables[table] = rows.filter((row) => !matches(row));
        return { data: null, error: null };
      }
      if (query.op === "update") {
        for (const row of matched) Object.assign(row, query.payload);
        return { data: matched.map((row) => ({ ...row })), error: null };
      }
      if (query.single) {
        if (matched.length > 1) {
          return {
            data: null,
            error: { code: "PGRST116", message: "multiple rows" },
          };
        }
        return { data: matched[0] ? { ...matched[0] } : null, error: null };
      }
      return { data: matched.map((row) => ({ ...row })), error: null };
    }

    return api;
  }

  return { from, tables };
}

function postWebhook() {
  return POST(
    new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: "{}",
      headers: { "stripe-signature": "t=1,v1=test" },
    })
  );
}

function stripeEvent(
  id: string,
  type: string,
  object: Record<string, unknown>,
  account?: string
): Stripe.Event {
  return {
    id,
    object: "event",
    type,
    created: 1_700_000_000,
    account,
    data: { object },
  } as unknown as Stripe.Event;
}

const logs = { info: [] as string[], error: [] as string[] };
const originalEnv = {
  platform: process.env.STRIPE_WEBHOOK_SECRET,
  connect: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
  admins: process.env.ADMIN_EMAILS,
};

beforeEach(() => {
  logs.info = [];
  logs.error = [];
  vi.spyOn(console, "info").mockImplementation((message) => {
    logs.info.push(String(message));
  });
  vi.spyOn(console, "error").mockImplementation((message, extra) => {
    logs.error.push(`${String(message)} ${extra ?? ""}`);
  });
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  process.env.STRIPE_WEBHOOK_SECRET = PLATFORM_SECRET;
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = CONNECT_SECRET;
  state.client = createMemorySupabase();
  state.constructEvent = () => {
    throw new Error("signature mismatch");
  };
});

afterEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = originalEnv.platform;
  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = originalEnv.connect;
  process.env.ADMIN_EMAILS = originalEnv.admins;
  vi.restoreAllMocks();
});

function loggedText() {
  return [...logs.info, ...logs.error].join("\n");
}

describe("stripe webhook signature", () => {
  it("verifies with the platform secret", async () => {
    state.constructEvent = (_payload, _signature, secret) => {
      if (secret !== PLATFORM_SECRET) throw new Error("platform secret rejected");
      return stripeEvent("evt_platform", "ping", { id: "obj_1" });
    };

    const response = await postWebhook();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(logs.info.some((line) => line.includes("platform"))).toBe(true);
    expect(loggedText()).not.toContain(PLATFORM_SECRET);
    expect(loggedText()).not.toContain(CONNECT_SECRET);
  });

  it("verifies with the Connect secret when the platform secret fails", async () => {
    const seen: string[] = [];
    state.constructEvent = (_payload, _signature, secret) => {
      seen.push(secret);
      if (secret === PLATFORM_SECRET) throw new Error("platform secret rejected");
      if (secret === CONNECT_SECRET) {
        return stripeEvent("evt_connect", "ping", { id: "obj_1" });
      }
      throw new Error("unexpected secret");
    };

    const response = await postWebhook();

    expect(response.status).toBe(200);
    expect(seen).toEqual([PLATFORM_SECRET, CONNECT_SECRET]);
    expect(logs.info.some((line) => line.includes("connect"))).toBe(true);
    expect(loggedText()).not.toContain(PLATFORM_SECRET);
    expect(loggedText()).not.toContain(CONNECT_SECRET);
  });

  it("returns 400 when every secret fails", async () => {
    state.constructEvent = () => {
      throw new Error("signature mismatch");
    };

    const response = await postWebhook();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid signature" });
    expect(state.client?.tables.processed_webhook_events ?? []).toHaveLength(0);
    expect(loggedText()).not.toContain(PLATFORM_SECRET);
    expect(loggedText()).not.toContain(CONNECT_SECRET);
  });

  it("returns 400 when no secrets are configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
    const constructEvent = vi.fn();
    state.constructEvent = constructEvent;

    const response = await postWebhook();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid signature" });
    expect(constructEvent).not.toHaveBeenCalled();
    expect(loggedText()).toContain("no webhook secrets configured");
  });
});

describe("transferReversalRecord", () => {
  it("does not add a reversal our refund code already stored", () => {
    expect(
      transferReversalRecord({
        storedReversedCents: 8500,
        stripeAmountReversedCents: 8500,
      })
    ).toEqual({ nextReversedCents: 8500, alreadyRecorded: true });
  });

  it("sets the cumulative Stripe amount when our row is behind", () => {
    expect(
      transferReversalRecord({
        storedReversedCents: 100,
        stripeAmountReversedCents: 250,
      })
    ).toEqual({ nextReversedCents: 250, alreadyRecorded: false });
  });
});

describe("transfer.reversed", () => {
  const reversedAt = new Date(1_700_000_100 * 1000).toISOString();

  function seedDestinationBooking() {
    state.client = createMemorySupabase({
      doctors: [{ id: "doc-1", stripe_account_id: "acct_doctor" }],
      bookings: [
        {
          id: "book-1",
          doctor_id: "doc-1",
          booking_number: "MD-TEST",
          stripe_charge_id: "ch_test",
          stripe_destination_transfer_id: "tr_dest",
          stripe_reassignment_transfer_id: null,
          destination_transfer_reversed_cents: null,
          destination_transfer_reversed_at: null,
        },
      ],
    });
  }

  function acceptPlatform(event: Stripe.Event) {
    state.constructEvent = (_payload, _signature, secret) => {
      if (secret !== PLATFORM_SECRET) throw new Error("platform secret rejected");
      return event;
    };
  }

  it("records the reversal and ignores a replay of the same event id", async () => {
    seedDestinationBooking();
    acceptPlatform(
      stripeEvent("evt_reverse_1", "transfer.reversed", {
        id: "tr_dest",
        object: "transfer",
        amount: 10000,
        amount_reversed: 2500,
        destination: "acct_doctor",
        reversals: {
          object: "list",
          data: [
            {
              id: "trr_1",
              object: "transfer_reversal",
              amount: 2500,
              created: 1_700_000_100,
            },
          ],
        },
      })
    );

    const first = await postWebhook();
    expect(first.status).toBe(200);
    const booking = state.client?.tables.bookings[0];
    expect(booking).toMatchObject({
      destination_transfer_reversed_cents: 2500,
      destination_transfer_reversed_at: reversedAt,
      destination_transfer_reversal_reconciled_at: reversedAt,
    });
    expect(state.client?.tables.stripe_transfer_reversal_audits).toEqual([
      expect.objectContaining({
        stripe_event_id: "evt_reverse_1",
        stripe_transfer_id: "tr_dest",
        stripe_reversal_id: "trr_1",
        amount_reversed_cents: 2500,
        reversed_at: reversedAt,
        booking_id: "book-1",
        match_kind: "booking_destination",
        already_recorded: false,
        connected_account_id: "acct_doctor",
      }),
    ]);

    const second = await postWebhook();
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual({
      received: true,
      duplicate: true,
    });
    expect(state.client?.tables.stripe_transfer_reversal_audits).toHaveLength(1);
    expect(state.client?.tables.bookings[0]).toMatchObject({
      destination_transfer_reversed_cents: 2500,
    });
  });

  it("does not add reversed_cents when the wallet transfer was already reversed", async () => {
    state.client = createMemorySupabase({
      doctors: [{ id: "doc-1", stripe_account_id: "acct_doctor" }],
      doctor_wallet_credit_transfers: [
        {
          id: "wct-1",
          booking_id: "book-1",
          doctor_id: "doc-1",
          amount_cents: 8500,
          reversed_cents: 8500,
          status: "reversed",
          stripe_transfer_id: "tr_credit",
        },
      ],
    });
    acceptPlatform(
      stripeEvent("evt_credit_reverse", "transfer.reversed", {
        id: "tr_credit",
        object: "transfer",
        amount: 8500,
        amount_reversed: 8500,
        destination: "acct_doctor",
        reversals: {
          object: "list",
          data: [{ id: "trr_credit", amount: 8500, created: 1_700_000_100 }],
        },
      })
    );

    const response = await postWebhook();
    expect(response.status).toBe(200);
    expect(state.client?.tables.doctor_wallet_credit_transfers[0]).toMatchObject({
      reversed_cents: 8500,
      status: "reversed",
      reversal_reconciled_at: reversedAt,
    });
    expect(state.client?.tables.stripe_transfer_reversal_audits[0]).toMatchObject({
      match_kind: "wallet_credit",
      already_recorded: true,
      amount_reversed_cents: 8500,
    });
  });

  it("returns 200 and leaves rows unchanged for an unknown transfer id", async () => {
    seedDestinationBooking();
    const before = structuredClone(state.client?.tables.bookings[0]);
    acceptPlatform(
      stripeEvent("evt_unknown_transfer", "transfer.reversed", {
        id: "tr_missing",
        object: "transfer",
        amount: 1000,
        amount_reversed: 1000,
        destination: "acct_doctor",
      })
    );

    const response = await postWebhook();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true });
    expect(state.client?.tables.bookings[0]).toEqual(before);
    expect(state.client?.tables.stripe_transfer_reversal_audits ?? []).toHaveLength(0);
    expect(state.client?.tables.doctor_wallet_credit_transfers ?? []).toHaveLength(0);
  });
});

describe("charge.dispute.created", () => {
  const createdAt = new Date(1_700_000_200 * 1000).toISOString();

  function seedCharge() {
    state.client = createMemorySupabase({
      doctors: [{ id: "doc-1", stripe_account_id: "acct_doctor" }],
      profiles: [{ id: "admin-1", email: "ops@example.com", role: "admin" }],
      bookings: [
        {
          id: "book-1",
          doctor_id: "doc-1",
          booking_number: "MD-TEST",
          stripe_charge_id: "ch_test",
          stripe_dispute_id: null,
        },
      ],
    });
    process.env.ADMIN_EMAILS = "ops@example.com";
  }

  function disputeEvent(id = "evt_dispute_1", chargeId = "ch_test") {
    return stripeEvent(id, "charge.dispute.created", {
      id: "dp_1",
      object: "dispute",
      charge: chargeId,
      amount: 5000,
      currency: "gbp",
      reason: "fraudulent",
      status: "needs_response",
      created: 1_700_000_200,
    });
  }

  it("flags the booking, notifies admin once, and ignores a replay", async () => {
    seedCharge();
    const sendEmail = vi
      .spyOn(emailClient, "sendEmail")
      .mockResolvedValue({ success: true });
    state.constructEvent = (_payload, _signature, secret) => {
      if (secret !== PLATFORM_SECRET) throw new Error("platform secret rejected");
      return disputeEvent();
    };

    const first = await postWebhook();
    expect(first.status).toBe(200);
    expect(state.client?.tables.bookings[0]).toMatchObject({
      stripe_dispute_id: "dp_1",
      stripe_dispute_status: "needs_response",
      stripe_dispute_amount_cents: 5000,
      stripe_dispute_reason: "fraudulent",
      stripe_dispute_created_at: createdAt,
      stripe_dispute_account_id: null,
    });
    expect(state.client?.tables.notifications).toEqual([
      expect.objectContaining({
        user_id: "admin-1",
        type: "charge_dispute_created",
      }),
    ]);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(sendEmail.mock.calls[0]?.[0]).toMatchObject({
      to: "ops@example.com",
    });
    const email = sendEmail.mock.calls[0]?.[0];
    expect(email?.subject).toContain("MD-TEST");
    expect(email?.html).toContain("dp_1");
    expect(email?.html).toContain("No refund and no transfer reversal");

    const second = await postWebhook();
    expect(second.status).toBe(200);
    await expect(second.json()).resolves.toEqual({
      received: true,
      duplicate: true,
    });
    expect(state.client?.tables.notifications).toHaveLength(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("returns 200 and does not flag or notify for an unknown charge id", async () => {
    seedCharge();
    const sendEmail = vi
      .spyOn(emailClient, "sendEmail")
      .mockResolvedValue({ success: true });
    const before = structuredClone(state.client?.tables.bookings[0]);
    state.constructEvent = () => disputeEvent("evt_unknown_charge", "ch_missing");

    const response = await postWebhook();
    expect(response.status).toBe(200);
    expect(state.client?.tables.bookings[0]).toEqual(before);
    expect(state.client?.tables.notifications ?? []).toHaveLength(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
