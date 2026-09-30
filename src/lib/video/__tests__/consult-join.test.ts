import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mintConsultJoin } from "@/actions/consult-join";
import {
  assessConsultJoin,
  issueConsultJoin,
  JOIN_MESSAGES,
  type ConsultJoinBooking,
  type ConsultJoinCaller,
} from "@/lib/video/consult-join";
import { signGuestConsultJoin } from "@/lib/video/guest-join-link";
import { loadConsultJoinAttempt } from "@/lib/video/load-consult-join";
import { consultMeetingBounds } from "@/lib/video/meeting-window";
import { CONSULT_JOIN_SOURCES, type ConsultJoinSource } from "@/lib/video/join-source";

const TOKEN = "scoped-meeting-token";
const ROOM = "https://md360.daily.co/md-bk-1";
const JOIN_SECRET = "consult-join-link-secret-32-bytes!!";
const calls: { url: string; body: string }[] = [];

const session = vi.hoisted(() => ({
  booking: null as Record<string, unknown> | null,
  user: null as { id: string } | null,
  callerDoctorId: null as string | null,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      const query = {
        select() {
          return query;
        },
        eq() {
          return query;
        },
        maybeSingle: async () => {
          if (table === "bookings") return { data: session.booking, error: null };
          if (table === "doctors") {
            return {
              data: session.callerDoctorId ? { id: session.callerDoctorId } : null,
              error: null,
            };
          }
          return { data: null, error: null };
        },
      };
      return query;
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: session.user } }),
    },
  }),
}));

const booking = (overrides: Partial<ConsultJoinBooking> = {}): ConsultJoinBooking => ({
  id: "11111111-1111-4111-8111-111111111111",
  bookingNumber: "MD-7K3Q9X",
  status: "confirmed",
  consultationType: "video",
  patientId: "patient-user",
  doctorId: "doctor-row",
  doctorProfileId: "doctor-user",
  roomName: "md-bk-1",
  roomUrl: ROOM,
  appointmentDate: "2026-09-26",
  startTime: "2026-09-26T09:00:00.000Z",
  endTime: "2026-09-26T09:30:00.000Z",
  patientName: "Ada Patient",
  doctorName: "Kim Doctor",
  ...overrides,
});

const during = new Date("2026-09-26T09:05:00.000Z");
const tooEarly = new Date("2026-09-26T08:40:00.000Z");
const tooLate = new Date("2026-09-26T10:05:00.000Z");

function timesOf(row: ConsultJoinBooking = booking()) {
  return {
    appointmentDate: row.appointmentDate,
    startTime: row.startTime,
    endTime: row.endTime,
  };
}

function caller(overrides: Partial<ConsultJoinCaller> = {}): ConsultJoinCaller {
  return {
    userId: null,
    doctorId: null,
    guestSignature: null,
    guestLinkExp: null,
    ...overrides,
  };
}

function guestProof(row: ConsultJoinBooking = booking()) {
  const signed = signGuestConsultJoin(row.id, row.bookingNumber, timesOf(row));
  if (!signed) throw new Error("expected a guest signature");
  return signed;
}

function allowedCaller(
  source: ConsultJoinSource,
  row: ConsultJoinBooking = booking()
): ConsultJoinCaller {
  const signed = guestProof(row);
  if (source === "doctor_dashboard") {
    return caller({
      userId: row.doctorProfileId,
      doctorId: row.doctorId,
    });
  }
  if (source === "guest_join") {
    return caller({ guestSignature: signed.sig, guestLinkExp: signed.exp });
  }
  return caller({
    userId: row.patientId,
    guestSignature: signed.sig,
    guestLinkExp: signed.exp,
  });
}

function bookingRow(row: ConsultJoinBooking = booking()) {
  return {
    id: row.id,
    booking_number: row.bookingNumber,
    status: row.status,
    consultation_type: row.consultationType,
    patient_id: row.patientId,
    doctor_id: row.doctorId,
    appointment_date: row.appointmentDate,
    start_time: row.startTime,
    end_time: row.endTime,
    video_room_url: row.roomUrl,
    daily_room_name: row.roomName,
    patient: { first_name: "Ada", last_name: "Patient" },
    doctor: {
      id: row.doctorId,
      profile_id: row.doctorProfileId,
      profile: { first_name: "Kim", last_name: "Doctor" },
    },
  };
}

beforeEach(() => {
  calls.length = 0;
  session.booking = null;
  session.user = null;
  session.callerDoctorId = null;
  process.env.DAILY_API_KEY = "test-daily-key";
  process.env.CONSULT_JOIN_LINK_SECRET = JOIN_SECRET;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), body: String(init?.body ?? "") });
      if (String(url).endsWith("/meeting-tokens")) {
        return new Response(JSON.stringify({ token: TOKEN }), { status: 200 });
      }
      return new Response(JSON.stringify({ privacy: "private" }), { status: 200 });
    })
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function tokenBody() {
  const mint = calls.find((call) => call.url.endsWith("/meeting-tokens"));
  expect(mint).toBeTruthy();
  return JSON.parse(mint!.body).properties as {
    is_owner: boolean;
    room_name: string;
    exp: number;
    nbf: number;
    eject_at_token_exp: boolean;
    user_id: string;
  };
}

describe("issueConsultJoin", () => {
  it.each(CONSULT_JOIN_SOURCES)(
    "%s mints a token for the allowed participant",
    async (source) => {
      const result = await issueConsultJoin({
        source,
        booking: booking(),
        caller: allowedCaller(source),
        now: during,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.joinUrl).toContain("t=");
      expect(result.joinUrl.startsWith(ROOM)).toBe(true);
      const props = tokenBody();
      const bounds = consultMeetingBounds(timesOf());
      expect(bounds).toBeTruthy();
      expect(props.room_name).toBe("md-bk-1");
      expect(props.eject_at_token_exp).toBe(true);
      expect(props.nbf).toBe(bounds!.nbf);
      expect(props.exp).toBe(bounds!.exp);
      expect(props.is_owner).toBe(source === "doctor_dashboard");
      expect(calls[0]?.url).toContain("/rooms/md-bk-1");
      expect(JSON.parse(calls[0]!.body).privacy).toBe("private");
      const logged = [
        ...vi.mocked(console.log).mock.calls,
        ...vi.mocked(console.error).mock.calls,
      ]
        .flat()
        .join(" ");
      expect(logged).not.toContain(TOKEN);
      calls.length = 0;
    }
  );

  it.each(CONSULT_JOIN_SOURCES)(
    "%s refuses the wrong user without calling Daily",
    async (source) => {
      const result = await issueConsultJoin({
        source,
        booking: booking(),
        caller: caller({ userId: "someone-else", doctorId: "other-doctor" }),
        now: during,
      });
      expect(result).toEqual({ ok: false, error: JOIN_MESSAGES.wrongUser });
      expect(calls).toHaveLength(0);
    }
  );

  it.each(CONSULT_JOIN_SOURCES)("%s refuses a cancelled booking", async (source) => {
    const row = booking({ status: "cancelled_patient" });
    const result = await issueConsultJoin({
      source,
      booking: row,
      caller: allowedCaller(source, row),
      now: during,
    });
    expect(result).toEqual({ ok: false, error: JOIN_MESSAGES.cancelled });
    expect(calls).toHaveLength(0);
  });

  it.each(CONSULT_JOIN_SOURCES)("%s refuses a refunded booking", async (source) => {
    const row = booking({ status: "refunded" });
    const result = await issueConsultJoin({
      source,
      booking: row,
      caller: allowedCaller(source, row),
      now: during,
    });
    expect(result).toEqual({ ok: false, error: JOIN_MESSAGES.refunded });
    expect(calls).toHaveLength(0);
  });

  it.each(["no_show", "completed", "pending_payment"] as const)(
    "refuses %s without calling Daily",
    async (status) => {
      const result = await issueConsultJoin({
        source: "patient_dashboard",
        booking: booking({ status }),
        caller: allowedCaller("patient_dashboard"),
        now: during,
      });
      expect(result).toEqual({ ok: false, error: JOIN_MESSAGES.notJoinable });
      expect(calls).toHaveLength(0);
    }
  );

  it.each(CONSULT_JOIN_SOURCES)(
    "%s refuses requests outside the join window",
    async (source) => {
      const row = booking();
      const early = await issueConsultJoin({
        source,
        booking: row,
        caller: allowedCaller(source, row),
        now: tooEarly,
      });
      const late = await issueConsultJoin({
        source,
        booking: row,
        caller: allowedCaller(source, row),
        now: tooLate,
      });
      expect(early).toEqual({ ok: false, error: JOIN_MESSAGES.tooEarly });
      if (source === "guest_join") {
        expect(late).toEqual({ ok: false, error: JOIN_MESSAGES.wrongUser });
      } else {
        expect(late).toEqual({ ok: false, error: JOIN_MESSAGES.tooLate });
      }
      expect(calls).toHaveLength(0);
    }
  );

  it("does not reveal status or timing to an unauthorised caller", async () => {
    const stranger = caller({ userId: "stranger", doctorId: "other-doctor" });
    for (const status of ["cancelled_patient", "no_show", "completed", "pending_payment", "confirmed"]) {
      const result = await issueConsultJoin({
        source: "patient_dashboard",
        booking: booking({ status }),
        caller: stranger,
        now: tooEarly,
      });
      expect(result).toEqual({ ok: false, error: JOIN_MESSAGES.wrongUser });
    }
    expect(calls).toHaveLength(0);
  });

  it("gives is_owner only to the assigned doctor, including a clinic org member who is that doctor", async () => {
    const doctor = await issueConsultJoin({
      source: "doctor_dashboard",
      booking: booking(),
      caller: caller({ userId: "doctor-user", doctorId: "doctor-row" }),
      now: during,
    });
    expect(doctor.ok && doctor.role).toBe("doctor");
    expect(tokenBody().is_owner).toBe(true);

    calls.length = 0;
    const byProfile = await issueConsultJoin({
      source: "email_join_page",
      booking: booking(),
      caller: caller({ userId: "doctor-user", doctorId: null }),
      now: during,
    });
    expect(byProfile.ok && byProfile.role).toBe("doctor");
    expect(tokenBody().is_owner).toBe(true);
    expect(tokenBody().user_id).toBe("doctor-user");
  });

  it("refuses another clinic doctor who is not assigned to the booking", async () => {
    const result = await assessConsultJoin({
      source: "doctor_dashboard",
      booking: booking(),
      caller: caller({ userId: "colleague-user", doctorId: "colleague-row" }),
      now: during,
    });
    expect(result).toEqual({ ok: false, error: JOIN_MESSAGES.wrongUser });
  });

  it("lets a verified guest link mint a patient token and rejects a bad signature", async () => {
    const signed = guestProof();
    const ok = await issueConsultJoin({
      source: "guest_join",
      booking: booking(),
      caller: caller({ guestSignature: signed.sig, guestLinkExp: signed.exp }),
      now: during,
    });
    expect(ok.ok).toBe(true);
    expect(tokenBody().is_owner).toBe(false);
    expect(tokenBody().user_id).toBe("patient-user");

    calls.length = 0;
    const bad = await issueConsultJoin({
      source: "guest_join",
      booking: booking(),
      caller: caller({ guestSignature: "not-the-signature", guestLinkExp: signed.exp }),
      now: during,
    });
    expect(bad).toEqual({ ok: false, error: JOIN_MESSAGES.wrongUser });
    expect(calls).toHaveLength(0);
  });

  it("rejects an expired guest link and a link signed before a reschedule", async () => {
    const signed = guestProof();
    const expired = await issueConsultJoin({
      source: "guest_join",
      booking: booking(),
      caller: caller({ guestSignature: signed.sig, guestLinkExp: signed.exp }),
      now: tooLate,
    });
    expect(expired).toEqual({ ok: false, error: JOIN_MESSAGES.wrongUser });

    const moved = booking({ endTime: "2026-09-26T11:00:00.000Z" });
    const stale = await issueConsultJoin({
      source: "email_join_page",
      booking: moved,
      caller: caller({ guestSignature: signed.sig, guestLinkExp: signed.exp }),
      now: during,
    });
    expect(stale).toEqual({ ok: false, error: JOIN_MESSAGES.wrongUser });

    const fresh = guestProof(moved);
    const ok = await issueConsultJoin({
      source: "guest_join",
      booking: moved,
      caller: caller({ guestSignature: fresh.sig, guestLinkExp: fresh.exp }),
      now: during,
    });
    expect(ok.ok).toBe(true);
    expect(calls.filter((call) => call.url.endsWith("/meeting-tokens"))).toHaveLength(1);
  });

  it("does not accept a guest signature on the patient or doctor dashboard", async () => {
    const signed = guestProof();
    for (const source of ["patient_dashboard", "doctor_dashboard"] as const) {
      const result = await issueConsultJoin({
        source,
        booking: booking(),
        caller: caller({ guestSignature: signed.sig, guestLinkExp: signed.exp }),
        now: during,
      });
      expect(result.ok).toBe(false);
    }
    expect(calls).toHaveLength(0);
  });

  it("returns roomFailed when the room lock throws and does not mint", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 500 }))
    );
    const result = await issueConsultJoin({
      source: "patient_dashboard",
      booking: booking(),
      caller: allowedCaller("patient_dashboard"),
      now: during,
    });
    expect(result).toEqual({ ok: false, error: JOIN_MESSAGES.roomFailed });
  });
});

describe("mintConsultJoin", () => {
  it("mints for a guest signature and refuses a stranger without calling Daily", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(during);
    const row = booking();
    const signed = guestProof(row);
    session.booking = bookingRow(row);
    session.user = null;

    const ok = await mintConsultJoin({
      bookingId: row.id,
      source: "guest_join",
      guestSignature: signed.sig,
      exp: signed.exp,
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.joinUrl).toContain("t=");

    calls.length = 0;
    session.user = { id: "stranger" };
    session.callerDoctorId = "other-doctor";
    const loaded = await loadConsultJoinAttempt({
      bookingId: row.id,
      guestSignature: null,
      guestLinkExp: null,
    });
    expect(loaded?.caller.userId).toBe("stranger");
    const issued = loaded
      ? await issueConsultJoin({
          source: "patient_dashboard",
          booking: loaded.booking,
          caller: loaded.caller,
          now: during,
        })
      : null;
    expect(issued).toEqual({ ok: false, error: JOIN_MESSAGES.wrongUser });

    const denied = await mintConsultJoin({
      bookingId: row.id,
      source: "patient_dashboard",
    });
    expect(denied).toEqual({ ok: false, error: JOIN_MESSAGES.wrongUser });
    expect(calls).toHaveLength(0);
    vi.useRealTimers();
  });

  it("refuses a malformed booking id without calling Daily", async () => {
    const result = await mintConsultJoin({
      bookingId: "not-a-uuid",
      source: "guest_join",
    });
    expect(result).toEqual({ ok: false, error: JOIN_MESSAGES.unauthorised });
    expect(calls).toHaveLength(0);
  });
});
