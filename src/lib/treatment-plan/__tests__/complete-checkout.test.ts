import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { applyTreatmentPlanCheckoutPayment } from "@/lib/treatment-plan/complete-checkout";

vi.mock("@/lib/booking/finalize-confirmed-booking", () => ({
  ensureDailyVideoRoom: vi.fn().mockResolvedValue("https://daily.test/room"),
}));

vi.mock("@/lib/google/sync", () => ({
  exportBookingToGoogleCalendar: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/microsoft/sync", () => ({
  exportBookingToMicrosoftCalendar: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/caldav/sync", () => ({
  exportBookingToCalDAV: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/email/softsmoke-send", () => ({
  resolvePatientConfirmationEmail: vi.fn(() => ({
    subject: "Confirmed",
    html: "<p>ok</p>",
  })),
}));
vi.mock("@/lib/whatsapp/client", () => ({
  sendWhatsAppTemplate: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

type Op = {
  table: string;
  action: string;
  payload?: unknown;
  filters: Record<string, unknown>;
};

function makeClient(state: {
  plan: Record<string, unknown> | null;
  bookingCount: number;
  booking: Record<string, unknown> | null;
  doctorProfileId?: string;
}) {
  const ops: Op[] = [];

  const client = {
    ops,
    from(table: string) {
      const filters: Record<string, unknown> = {};
      const builder: Record<string, unknown> = {
        select(columns?: string, opts?: { count?: string; head?: boolean }) {
          ops.push({ table, action: "select", payload: { columns, opts }, filters });
          builder._isCount = Boolean(opts?.head && opts?.count);
          return builder;
        },
        update(payload: unknown) {
          ops.push({ table, action: "update", payload, filters });
          return builder;
        },
        insert(payload: unknown) {
          ops.push({ table, action: "insert", payload, filters });
          return builder;
        },
        eq(col: string, val: unknown) {
          filters[col] = val;
          return builder;
        },
        in(col: string, val: unknown) {
          filters[`${col}_in`] = val;
          return builder;
        },
        maybeSingle: async () => {
          if (table === "treatment_plans") return { data: state.plan, error: null };
          if (table === "doctors")
            return { data: { profile_id: state.doctorProfileId || "profile-1" }, error: null };
          if (table === "profiles")
            return { data: { first_name: "Pat", last_name: "Ient" }, error: null };
          return { data: null, error: null };
        },
        single: async () => {
          if (table === "bookings") return { data: state.booking, error: null };
          return { data: null, error: null };
        },
        then(resolve: (v: unknown) => void) {
          if (builder._isCount) {
            resolve({ count: state.bookingCount, error: null });
          } else {
            resolve({ data: null, error: null });
          }
        },
      };
      return builder;
    },
  };

  return client;
}

describe("applyTreatmentPlanCheckoutPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns handled:false when metadata has no treatment_plan_id", async () => {
    const client = makeClient({ plan: null, bookingCount: 0, booking: null });
    const result = await applyTreatmentPlanCheckoutPayment(
      { id: "cs_1", metadata: {} },
      client
    );
    expect(result).toEqual({ handled: false });
  });

  it("confirms first booking and marks pay_full plan paid/in_progress", async () => {
    const client = makeClient({
      plan: {
        id: "tp-1",
        status: "sent",
        sessions_completed: 0,
        total_sessions: 3,
        payment_type: "pay_full",
        patient_id: "pat-1",
        doctor_id: "doc-1",
        title: "Physio package",
        discounted_total_cents: 30000,
        platform_fee_per_session_cents: 0,
        total_platform_fee_cents: 0,
        currency: "gbp",
        paid_at: null,
        token: "tok",
      },
      bookingCount: 1,
      booking: {
        id: "bk-1",
        booking_number: "MD-123456",
        doctor_id: "doc-1",
        appointment_date: "2026-10-01",
        start_time: "10:00:00",
        end_time: "10:30:00",
        consultation_type: "in_person",
        consultation_fee_cents: 10000,
        platform_fee_cents: 0,
        total_amount_cents: 30000,
        currency: "gbp",
        video_room_url: null,
        daily_room_name: null,
        patient: {
          first_name: "Pat",
          last_name: "Ient",
          email: "pat@example.com",
          phone: null,
          notification_whatsapp: false,
          preferred_locale: "en",
        },
        doctor: {
          id: "doc-1",
          clinic_name: "Clinic",
          address: "1 High St",
          slug: "dr-test",
          profile: { first_name: "Doc", last_name: "Tor", email: "doc@example.com" },
        },
      },
      doctorProfileId: "doc-profile",
    });

    const result = await applyTreatmentPlanCheckoutPayment(
      {
        id: "cs_tp",
        payment_intent: "pi_1",
        metadata: {
          treatment_plan_id: "tp-1",
          first_booking_id: "bk-1",
        },
      },
      client
    );

    expect(result).toEqual({ handled: true });

    const bookingUpdate = client.ops.find(
      (o) => o.table === "bookings" && o.action === "update"
    );
    expect(bookingUpdate?.payload).toMatchObject({
      status: "confirmed",
      stripe_payment_intent_id: "pi_1",
    });

    const planUpdate = client.ops.find(
      (o) => o.table === "treatment_plans" && o.action === "update"
    );
    expect(planUpdate?.payload).toMatchObject({
      status: "in_progress",
      sessions_completed: 1,
      paid_at: expect.any(String),
    });
  });
});

describe("stripe webhook wiring", () => {
  it("routes treatment_plan_id before generic booking_id handling", () => {
    const source = readFileSync(
      join(process.cwd(), "src/app/api/webhooks/stripe/route.ts"),
      "utf8"
    );
    expect(source).toContain("applyTreatmentPlanCheckoutPayment");
    expect(source).toContain("treatmentPlanId && session.mode === \"payment\"");
    const tpIdx = source.indexOf("treatmentPlanId && session.mode");
    const bookingIdx = source.indexOf(
      "} else if (bookingId && session.mode === \"payment\")"
    );
    expect(tpIdx).toBeGreaterThan(-1);
    expect(bookingIdx).toBeGreaterThan(tpIdx);
  });
});
