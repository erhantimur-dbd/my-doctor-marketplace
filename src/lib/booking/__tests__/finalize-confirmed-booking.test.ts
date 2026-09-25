import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRoom, getRoom } from "@/lib/daily/client";
import { sendEmail } from "@/lib/email/client";
import {
  confirmBookingWithoutStripeCheckout,
  dailyRoomExpiresAtUnix,
  dailyRoomNameForBooking,
  finalizeConfirmedBookingById,
} from "@/lib/booking/finalize-confirmed-booking";

const BOOKING_ID = "7696f804-21ff-40bf-be4a-4d3c2aaa244d";
const DOCTOR_ID = "8a9b6ac9-f6f1-4b6a-b108-837a704444dc";
const ROOM_URL = "https://example.daily.co/md-bk-20260925-a856";
const ROOM_NAME = "md-bk-20260925-a856";

const clientRef = vi.hoisted(() => ({
  current: null as {
    from: (table: string) => unknown;
    ops: Op[];
  } | null,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => clientRef.current,
}));

vi.mock("@/lib/daily/client", () => ({
  createRoom: vi.fn(),
  getRoom: vi.fn(),
}));

vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/sms/client", () => ({
  sendSms: vi.fn().mockResolvedValue({ success: true }),
}));

type Op = {
  table: string;
  action: "select" | "update" | "insert";
  payload?: unknown;
  filters: Record<string, unknown>;
};

let bookingRow: Record<string, unknown>;
let existingNotification: { id: string } | null;
let failStatusUpdate: boolean;

function baseBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: BOOKING_ID,
    booking_number: "BK-20260925-A856",
    patient_id: "patient-darren",
    doctor_id: DOCTOR_ID,
    appointment_date: "2026-09-26",
    start_time: "10:00:00",
    end_time: "10:30:00",
    consultation_type: "video",
    total_amount_cents: 0,
    currency: "gbp",
    video_room_url: null,
    daily_room_name: null,
    patient: { first_name: "Darren", last_name: "Been" },
    doctor: {
      clinic_name: "Softsmoke Clinic",
      address: "1 Smoke Street",
      profile: { first_name: "Vera", last_name: "Softsmoke" },
    },
    ...overrides,
  };
}

function installClient() {
  const ops: Op[] = [];
  const client = {
    ops,
    from(table: string) {
      const op: Op = { table, action: "select", filters: {} };
      let settled: Promise<{ data: unknown; error: unknown }> | null = null;

      const finish = () => {
        if (!settled) {
          const snapshot: Op = {
            table: op.table,
            action: op.action,
            payload: op.payload,
            filters: { ...op.filters },
          };
          ops.push(snapshot);
          if (snapshot.action === "select") {
            settled = Promise.resolve(selectResult(snapshot));
          } else if (
            failStatusUpdate &&
            snapshot.action === "update" &&
            snapshot.table === "bookings" &&
            snapshot.payload &&
            typeof snapshot.payload === "object" &&
            "status" in snapshot.payload
          ) {
            settled = Promise.resolve({
              data: null,
              error: { message: "confirm failed" },
            });
          } else {
            settled = Promise.resolve({ data: null, error: null });
          }
        }
        return settled;
      };

      const builder: Record<string, unknown> = {};
      const self = new Proxy(builder, {
        get(_target, prop) {
          if (prop === "then") {
            return (
              resolve: (value: unknown) => unknown,
              reject: (reason: unknown) => unknown
            ) => finish().then(resolve, reject);
          }
          return (...args: unknown[]) => {
            if (prop === "insert") {
              op.action = "insert";
              op.payload = args[0];
            } else if (prop === "update") {
              op.action = "update";
              op.payload = args[0];
            } else if (prop === "select") {
              op.action = "select";
            } else if (prop === "eq" || prop === "contains") {
              op.filters[`${String(prop)}:${String(args[0])}`] = args[1];
            } else if (prop === "maybeSingle" || prop === "single") {
              return finish();
            }
            return self;
          };
        },
      });
      return self;
    },
  };
  clientRef.current = client;
  return client;
}

function selectResult(op: Op): { data: unknown; error: unknown } {
  if (op.table === "bookings") return { data: bookingRow, error: null };
  if (op.table === "notifications") {
    return { data: existingNotification, error: null };
  }
  if (op.table === "doctors") {
    return {
      data: {
        id: DOCTOR_ID,
        profile_id: "doctor-profile-1",
        profile: {
          first_name: "Vera",
          last_name: "Softsmoke",
          email: "dbd.demo.email@gmail.com",
          phone: "+447700900123",
          notification_email: true,
          notification_sms: false,
        },
      },
      error: null,
    };
  }
  return { data: null, error: { message: `unexpected select ${op.table}` } };
}

function notificationInserts(ops: Op[]) {
  return ops.filter((op) => op.table === "notifications" && op.action === "insert");
}

function roomUpdates(ops: Op[]) {
  return ops.filter(
    (op) =>
      op.table === "bookings" &&
      op.action === "update" &&
      op.payload &&
      typeof op.payload === "object" &&
      "video_room_url" in op.payload
  );
}

beforeEach(() => {
  bookingRow = baseBooking();
  existingNotification = null;
  failStatusUpdate = false;
  installClient();
  vi.mocked(createRoom).mockReset();
  vi.mocked(getRoom).mockReset();
  vi.mocked(sendEmail).mockClear();
  vi.mocked(createRoom).mockResolvedValue({
    id: "room-1",
    name: ROOM_NAME,
    url: ROOM_URL,
    created_at: "2026-09-25T12:00:00Z",
    config: {},
  });
});

describe("daily room name", () => {
  it("matches the Checkout room slug for BK-20260925-A856", () => {
    expect(dailyRoomNameForBooking("BK-20260925-A856")).toBe(ROOM_NAME);
    expect(dailyRoomExpiresAtUnix("2026-09-26", "10:30:00")).toBe(
      Math.floor(new Date("2026-09-26T10:30:00").getTime() / 1000) + 3600
    );
  });
});

describe("charge-skip confirm", () => {
  it("confirms a video booking, persists Daily room fields, and inserts a doctor notification", async () => {
    const result = await confirmBookingWithoutStripeCheckout(BOOKING_ID);
    expect(result.error).toBeUndefined();

    const ops = clientRef.current?.ops ?? [];
    expect(ops).toContainEqual(
      expect.objectContaining({
        table: "bookings",
        action: "update",
        payload: { status: "confirmed" },
        filters: { "eq:id": BOOKING_ID },
      })
    );

    expect(createRoom).toHaveBeenCalledWith({
      name: ROOM_NAME,
      expiresAt: dailyRoomExpiresAtUnix("2026-09-26", "10:30:00"),
      maxParticipants: 2,
    });

    expect(roomUpdates(ops)).toEqual([
      expect.objectContaining({
        payload: {
          video_room_url: ROOM_URL,
          daily_room_name: ROOM_NAME,
        },
        filters: { "eq:id": BOOKING_ID },
      }),
    ]);

    const inserts = notificationInserts(ops);
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.payload).toEqual(
      expect.objectContaining({
        user_id: "doctor-profile-1",
        type: "new_booking",
        channel: "in_app",
        data: expect.objectContaining({ booking_id: BOOKING_ID }),
      })
    );

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "dbd.demo.email@gmail.com" })
    );
  });

  it("does not create a room for a non-video charge-skip, and still notifies the doctor", async () => {
    bookingRow = baseBooking({ consultation_type: "in_person" });

    await confirmBookingWithoutStripeCheckout(BOOKING_ID);

    expect(createRoom).not.toHaveBeenCalled();
    const ops = clientRef.current?.ops ?? [];
    expect(roomUpdates(ops)).toHaveLength(0);
    expect(notificationInserts(ops)).toHaveLength(1);
  });

  it("reuses an existing Daily room and does not insert a second notification", async () => {
    bookingRow = baseBooking({
      video_room_url: ROOM_URL,
      daily_room_name: ROOM_NAME,
    });
    existingNotification = { id: "notif-existing" };

    await finalizeConfirmedBookingById(BOOKING_ID);

    expect(createRoom).not.toHaveBeenCalled();
    const ops = clientRef.current?.ops ?? [];
    expect(roomUpdates(ops)).toHaveLength(0);
    expect(notificationInserts(ops)).toHaveLength(0);
  });

  it("loads an existing Daily room when create reports the name is taken", async () => {
    vi.mocked(createRoom).mockRejectedValue(
      new Error(
        'Daily.co createRoom failed (400): a room with name "md-bk-20260925-a856" already exists'
      )
    );
    vi.mocked(getRoom).mockResolvedValue({
      id: "room-existing",
      name: ROOM_NAME,
      url: ROOM_URL,
      created_at: "2026-09-25T12:00:00Z",
      config: {},
    });

    const result = await finalizeConfirmedBookingById(BOOKING_ID);

    expect(result.videoRoomUrl).toBe(ROOM_URL);
    expect(getRoom).toHaveBeenCalledWith(ROOM_NAME);
    expect(roomUpdates(clientRef.current?.ops ?? [])).toHaveLength(1);
  });

  it("returns an error and skips Daily when the confirm update fails", async () => {
    failStatusUpdate = true;
    const result = await confirmBookingWithoutStripeCheckout(BOOKING_ID);
    expect(result.error).toMatch(/Failed to create booking/);
    expect(createRoom).not.toHaveBeenCalled();
    expect(notificationInserts(clientRef.current?.ops ?? [])).toHaveLength(0);
  });
});

describe("checkout and charge-skip share finalize", () => {
  const bookingSource = readFileSync(
    join(process.cwd(), "src/actions/booking.ts"),
    "utf8"
  );
  const webhookSource = readFileSync(
    join(process.cwd(), "src/app/api/webhooks/stripe/route.ts"),
    "utf8"
  );
  const repairSource = readFileSync(
    join(process.cwd(), "scripts/repair-confirmed-video-booking.ts"),
    "utf8"
  );

  it("wires Softsmoke charge-skip and wallet-only confirm through the helper", () => {
    expect(bookingSource).toContain(
      "confirmBookingWithoutStripeCheckout(booking.id)"
    );
    expect(bookingSource).toContain("finalizeConfirmedBookingById(booking.id)");
    expect(bookingSource).toContain("destination: doctor.stripe_account_id");
  });

  it("uses the helper from checkout.session.completed instead of a second notify call", () => {
    expect(webhookSource).toContain("finalizeConfirmedBooking(");
    expect(webhookSource).toContain("ensureDailyVideoRoom(");
    expect(webhookSource).not.toContain("notifyDoctorOfNewBooking");
    expect(webhookSource).not.toContain("createRoom(");
  });

  it("documents the production repair for BK-20260925-A856", () => {
    expect(repairSource).toContain("finalizeConfirmedBookingById");
    expect(repairSource).toContain(BOOKING_ID);
    expect(repairSource).toContain("BK-20260925-A856");
  });
});
