import { describe, expect, it } from "vitest";
import {
  googleChannelToken,
  signCalendarOAuthState,
  verifyCalendarOAuthState,
} from "@/lib/calendar/oauth-state";

describe("calendar OAuth state", () => {
  it("round-trips a signed payload and rejects tampering", () => {
    process.env.CALENDAR_OAUTH_STATE_SECRET = "test-state-secret";
    const token = signCalendarOAuthState({
      userId: "user-1",
      doctorId: "doc-1",
    });
    expect(verifyCalendarOAuthState(token)).toEqual({
      userId: "user-1",
      doctorId: "doc-1",
    });
    expect(verifyCalendarOAuthState(token.replace(/.$/, "x"))).toBeNull();
    expect(
      verifyCalendarOAuthState(
        Buffer.from(JSON.stringify({ userId: "user-1", doctorId: "other" })).toString(
          "base64url"
        )
      )
    ).toBeNull();
  });

  it("derives a stable Google channel token", () => {
    process.env.CALENDAR_OAUTH_STATE_SECRET = "test-state-secret";
    const a = googleChannelToken("channel-1");
    const b = googleChannelToken("channel-1");
    const c = googleChannelToken("channel-2");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.length).toBeGreaterThan(16);
  });
});
