import { describe, expect, it } from "vitest";
import {
  dashboardPathForRole,
  resolvePostAuthPath,
} from "@/lib/auth/role-redirect";
import {
  looksLikeJwt,
  looksLikeRefreshToken,
} from "@/lib/auth/session-tokens";
import {
  hostMatchesWebAuthnRp,
  hostnameWithoutPort,
  DEFAULT_WEBAUTHN_RP_ID,
} from "@/lib/auth/webauthn";
import {
  isUserCancelledPasskey,
  passkeyErrorMessage,
} from "@/lib/auth/passkey-errors";
import { mfaFailureMessage } from "@/lib/auth/mfa-rest";

describe("dashboardPathForRole", () => {
  it("routes by role", () => {
    expect(dashboardPathForRole("en", "doctor")).toBe("/en/doctor-dashboard");
    expect(dashboardPathForRole("de", "admin")).toBe("/de/admin");
    expect(dashboardPathForRole("en", "patient")).toBe("/en/dashboard");
    expect(dashboardPathForRole("en", null)).toBe("/en/dashboard");
  });
});

describe("resolvePostAuthPath", () => {
  it("prefers safe relative redirects", () => {
    expect(resolvePostAuthPath("en", "patient", "/en/dashboard/bookings")).toBe(
      "/en/dashboard/bookings"
    );
  });

  it("rejects open redirects", () => {
    expect(resolvePostAuthPath("en", "doctor", "//evil.com")).toBe(
      "/en/doctor-dashboard"
    );
  });
});

describe("session token shape checks", () => {
  it("accepts jwt-shaped access tokens", () => {
    expect(looksLikeJwt("aaa.bbb.ccc")).toBe(false); // too short
    const jwt = `${"a".repeat(20)}.${"b".repeat(20)}.${"c".repeat(20)}`;
    expect(looksLikeJwt(jwt)).toBe(true);
  });

  it("rejects garbage refresh tokens", () => {
    expect(looksLikeRefreshToken("short")).toBe(false);
    expect(looksLikeRefreshToken("x".repeat(25))).toBe(true);
  });
});

describe("webauthn host matching", () => {
  it("allows localhost and rp subdomains", () => {
    expect(hostMatchesWebAuthnRp("localhost", DEFAULT_WEBAUTHN_RP_ID)).toBe(
      true
    );
    expect(
      hostMatchesWebAuthnRp("www.mydoctors360.com", DEFAULT_WEBAUTHN_RP_ID)
    ).toBe(true);
    expect(
      hostMatchesWebAuthnRp("mydoctors360.com", DEFAULT_WEBAUTHN_RP_ID)
    ).toBe(true);
  });

  it("rejects other brand TLDs for a .com RP ID", () => {
    expect(
      hostMatchesWebAuthnRp("www.mydoctors360.co.uk", DEFAULT_WEBAUTHN_RP_ID)
    ).toBe(false);
    expect(
      hostMatchesWebAuthnRp("www.mydoctors360.eu", DEFAULT_WEBAUTHN_RP_ID)
    ).toBe(false);
  });

  it("strips ports", () => {
    expect(hostnameWithoutPort("localhost:3000")).toBe("localhost");
  });
});

describe("passkey error helpers", () => {
  it("maps known codes", () => {
    expect(
      passkeyErrorMessage({ code: "passkey_disabled" }, "fallback")
    ).toMatch(/not enabled/i);
  });

  it("detects user cancellation", () => {
    expect(isUserCancelledPasskey({ name: "NotAllowedError" })).toBe(true);
    expect(isUserCancelledPasskey({ name: "Error", message: "x" })).toBe(false);
  });
});

describe("mfaFailureMessage", () => {
  it("uses translation keys", () => {
    const t = (key: string) => `t:${key}`;
    expect(mfaFailureMessage("verify", t)).toBe("t:error_invalid_code");
    expect(mfaFailureMessage("session", t)).toBe("t:error_session_expired");
  });
});
