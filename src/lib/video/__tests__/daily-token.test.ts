import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mintDailyMeetingToken } from "@/lib/video/daily-token";
import {
  EARLY_JOIN_WINDOW_SECONDS,
  MEETING_TOKEN_GRACE_AFTER_END_SECONDS,
} from "@/lib/video/meeting-window";

const TOKEN = "eyJ-test-meeting-token";
const calls: { url: string; init: RequestInit | undefined }[] = [];

beforeEach(() => {
  calls.length = 0;
  process.env.DAILY_API_KEY = "test-daily-key";
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (String(url).endsWith("/meeting-tokens")) {
        return new Response(JSON.stringify({ token: TOKEN }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ privacy: "private" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function propertiesOf(index: number) {
  return JSON.parse(String(calls[index]?.init?.body)).properties;
}

describe("mintDailyMeetingToken", () => {
  const nbf = 1_800_000_000;
  const exp = nbf + 3600;

  it("locks an existing public room before minting", async () => {
    const token = await mintDailyMeetingToken({
      roomName: "md-bk-1",
      userName: "Ada Patient",
      userId: "patient-1",
      isOwner: false,
      nbf,
      exp,
    });

    expect(token).toBe(TOKEN);
    expect(calls[0]?.url).toBe("https://api.daily.co/v1/rooms/md-bk-1");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body)).privacy).toBe("private");
    expect(calls[1]?.url).toBe("https://api.daily.co/v1/meeting-tokens");
    expect(calls[1]?.init?.method).toBe("POST");
  });

  it("sets room scope, exp, nbf, eject, and is_owner only for the doctor", async () => {
    await mintDailyMeetingToken({
      roomName: "md-bk-1",
      userName: "Dr Kim",
      userId: "doctor-profile-1",
      isOwner: true,
      nbf,
      exp,
    });
    await mintDailyMeetingToken({
      roomName: "md-bk-1",
      userName: "Ada Patient",
      userId: "patient-1",
      isOwner: false,
      nbf,
      exp,
    });

    const doctor = propertiesOf(1);
    const patient = propertiesOf(3);
    expect(doctor).toEqual({
      room_name: "md-bk-1",
      user_name: "Dr Kim",
      user_id: "doctor-profile-1",
      exp,
      nbf,
      eject_at_token_exp: true,
      is_owner: true,
    });
    expect(patient.is_owner).toBe(false);
    expect(patient.room_name).toBe("md-bk-1");
    expect(patient.eject_at_token_exp).toBe(true);
    expect(patient.user_id).toBe("patient-1");
  });

  it("does not log the meeting token", async () => {
    await mintDailyMeetingToken({
      roomName: "md-bk-1",
      userName: "Ada Patient",
      userId: "patient-1",
      isOwner: false,
      nbf,
      exp,
    });
    const logged = vi
      .mocked(console.log)
      .mock.calls.concat(
        vi.mocked(console.info).mock.calls,
        vi.mocked(console.warn).mock.calls,
        vi.mocked(console.error).mock.calls
      )
      .flat()
      .join(" ");
    expect(logged).not.toContain(TOKEN);
  });

  it("does not mint when the room cannot be locked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("no", { status: 500 }))
    );
    await expect(
      mintDailyMeetingToken({
        roomName: "md-bk-1",
        userName: "Ada",
        userId: "patient-1",
        isOwner: false,
        nbf,
        exp,
      })
    ).rejects.toThrow(/setRoomPrivate failed \(500\)/);
  });
});

describe("meeting window constants", () => {
  it("uses a 30 minute grace and the 10 minute early-join rule", () => {
    expect(MEETING_TOKEN_GRACE_AFTER_END_SECONDS).toBe(30 * 60);
    expect(EARLY_JOIN_WINDOW_SECONDS).toBe(10 * 60);
  });
});
