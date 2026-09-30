import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  assessConsultJoin,
  issueConsultJoin,
  JOIN_MESSAGES,
  type ConsultJoinBooking,
  type ConsultJoinCaller,
} from "@/lib/video/consult-join";
import { signGuestConsultJoin } from "@/lib/video/guest-join-link";
import {
  CONSULT_JOIN_SOURCES,
  type ConsultJoinSource,
} from "@/lib/video/join-source";

const TOKEN = "scoped-meeting-token";
const ROOM = "https://md360.daily.co/md-bk-1";
const calls: { url: string; body: string }[] = [];

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

function caller(overrides: Partial<ConsultJoinCaller> = {}): ConsultJoinCaller {
  return {
    userId: null,
    doctorId: null,
    guestSignature: null,
    ...overrides,
  };
}

beforeEach(() => {
  calls.length = 0;
  process.env.DAILY_API_KEY = "test-daily-key";
  process.env.CONSULT_JOIN_LINK_SECRET = "test-join-secret";
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
      const guestSignature = signGuestConsultJoin(
        booking().id,
        booking().bookingNumber
      );
      const allowed: ConsultJoinCaller =
        source === "doctor_dashboard"
          ? caller({ userId: "doctor-user", doctorId: "doctor-row" })
          : source === "patient_dashboard"
            ? caller({ userId: "patient-user" })
            : source === "guest_join"
              ? caller({ guestSignature })
              : caller({ userId: "patient-user" });

      const result = await issueConsultJoin({
        source,
        booking: booking(),
        caller: allowed,
        now: during,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.joinUrl).toContain("t=");
      expect(result.joinUrl.startsWith(ROOM)).toBe(true);
      const props = tokenBody();
      expect(props.room_name).toBe("md-bk-1");
      expect(props.eject_at_token_exp).toBe(true);
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
    const result = await issueConsultJoin({
      source,
      booking: booking({ status: "cancelled_patient" }),
      caller: caller({ userId: "patient-user" }),
      now: during,
    });
    expect(result).toEqual({ ok: false, error: JOIN_MESSAGES.cancelled });
    expect(calls).toHaveLength(0);
  });

  it.each(CONSULT_JOIN_SOURCES)("%s refuses a refunded booking", async (source) => {
    const result = await issueConsultJoin({
      source,
      booking: booking({ status: "refunded" }),
      caller: caller({ userId: "doctor-user", doctorId: "doctor-row" }),
      now: during,
    });
    expect(result).toEqual({ ok: false, error: JOIN_MESSAGES.refunded });
    expect(calls).toHaveLength(0);
  });

  it.each(CONSULT_JOIN_SOURCES)(
    "%s refuses requests outside the join window",
    async (source) => {
      const who = caller({ userId: "patient-user" });
      const early = await issueConsultJoin({
        source,
        booking: booking(),
        caller: who,
        now: tooEarly,
      });
      const late = await issueConsultJoin({
        source,
        booking: booking(),
        caller: who,
        now: tooLate,
      });
      expect(early).toEqual({ ok: false, error: JOIN_MESSAGES.tooEarly });
      expect(late).toEqual({ ok: false, error: JOIN_MESSAGES.tooLate });
      expect(calls).toHaveLength(0);
    }
  );

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
    const signature = signGuestConsultJoin(booking().id, booking().bookingNumber);
    const ok = await issueConsultJoin({
      source: "guest_join",
      booking: booking(),
      caller: caller({ guestSignature: signature }),
      now: during,
    });
    expect(ok.ok).toBe(true);
    expect(tokenBody().is_owner).toBe(false);
    expect(tokenBody().user_id).toBe("patient-user");

    calls.length = 0;
    const bad = await issueConsultJoin({
      source: "guest_join",
      booking: booking(),
      caller: caller({ guestSignature: "not-the-signature" }),
      now: during,
    });
    expect(bad).toEqual({ ok: false, error: JOIN_MESSAGES.wrongUser });
    expect(calls).toHaveLength(0);
  });

  it("does not accept a guest signature on the patient or doctor dashboard", async () => {
    const signature = signGuestConsultJoin(booking().id, booking().bookingNumber);
    for (const source of ["patient_dashboard", "doctor_dashboard"] as const) {
      const result = await issueConsultJoin({
        source,
        booking: booking(),
        caller: caller({ guestSignature: signature }),
        now: during,
      });
      expect(result.ok).toBe(false);
    }
    expect(calls).toHaveLength(0);
  });
});

describe("join path wiring", () => {
  const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");

  it("points every join surface at a server mint and keeps tokens out of email templates", () => {
    expect(read("src/components/booking/video-waiting-room.tsx")).toContain(
      'source="patient_dashboard"'
    );
    expect(read("src/components/booking/start-appointment-button.tsx")).toContain(
      'source="doctor_dashboard"'
    );
    expect(
      read("src/app/[locale]/(doctor)/doctor-dashboard/bookings/bookings-client.tsx")
    ).toContain('source="doctor_dashboard"');
    expect(read("src/app/[locale]/(doctor)/doctor-dashboard/page.tsx")).not.toContain(
      "videoRoomUrl="
    );
    expect(read("src/app/[locale]/(public)/booking-confirmation/page.tsx")).toContain(
      'source: "confirm"'
    );
    const joinPage = read("src/app/[locale]/(public)/join/[bookingId]/page.tsx");
    expect(joinPage).toContain('"guest_join"');
    expect(joinPage).toContain('"email_join_page"');
    expect(joinPage).toContain('"booking_confirmation"');
    expect(read("src/lib/daily/client.ts")).toContain('privacy: "private"');
    expect(read("src/lib/email/templates.ts")).toContain("safeConsultEmailHref");
    expect(read("src/app/api/cron/send-reminders/route.ts")).toContain(
      "consultJoinPageUrl"
    );
    expect(read("src/app/api/cron/send-reminders/route.ts")).not.toContain(
      "joinUrl: booking.video_room_url"
    );

    const sources: ConsultJoinSource[] = [...CONSULT_JOIN_SOURCES];
    expect(sources).toHaveLength(5);
  });
});
