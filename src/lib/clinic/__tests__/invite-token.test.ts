import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACCEPT_CLINIC_INVITE_COLUMNS,
  CLINIC_INVITE_TOKEN_PATTERN,
  isClinicInviteToken,
  PUBLIC_CLINIC_INVITE_COLUMNS,
} from "@/lib/clinic/invite-token";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("clinic invitation token", () => {
  const valid = "a".repeat(64);

  it("accepts the 32-byte hex token the table default generates", () => {
    expect(isClinicInviteToken(valid)).toBe(true);
    expect(isClinicInviteToken(valid.toUpperCase())).toBe(true);
    expect(CLINIC_INVITE_TOKEN_PATTERN.test(valid)).toBe(true);
  });

  it("rejects tokens that would let a caller list or probe the table", () => {
    expect(isClinicInviteToken("")).toBe(false);
    expect(isClinicInviteToken("pending")).toBe(false);
    expect(isClinicInviteToken("a".repeat(63))).toBe(false);
    expect(isClinicInviteToken(`${"a".repeat(64)}%`)).toBe(false);
    expect(isClinicInviteToken(` ${valid}`)).toBe(false);
    expect(isClinicInviteToken(`${valid.slice(0, 63)}g`)).toBe(false);
  });
});

describe("accept page lookup", () => {
  const action = read("src/actions/clinic-invitations.ts");
  const page = read("src/app/[locale]/(public)/invite/[token]/page.tsx");

  it("validates the token and loads one invite with the service role", () => {
    const resolver = action.slice(
      action.indexOf("export async function resolveInviteToken"),
      action.indexOf("export async function checkEmailRegistered")
    );
    expect(resolver).toContain("isClinicInviteToken(token)");
    expect(resolver).toContain("createAdminClient()");
    expect(resolver).toContain("PUBLIC_CLINIC_INVITE_COLUMNS");
    expect(resolver).not.toMatch(/\.select\(\s*["'`]\*/);
    expect(PUBLIC_CLINIC_INVITE_COLUMNS.split(", ").sort()).toEqual(
      [
        "email",
        "expires_at",
        "id",
        "organization_id",
        "role",
        "token",
      ].sort()
    );
    expect(page).toContain("resolveInviteToken");
    expect(page).not.toMatch(/clinic_invitations/);
  });

  it("accept actions reject a bad token before using the service role", () => {
    for (const name of [
      "acceptClinicInvitation",
      "acceptClinicInvitationWithTransfer",
    ]) {
      const start = action.indexOf(`export async function ${name}`);
      const next = action.indexOf("export async function", start + 1);
      const body = action.slice(start, next === -1 ? undefined : next);
      expect(body).toContain("isClinicInviteToken(token)");
      expect(body.indexOf("isClinicInviteToken(token)")).toBeLessThan(
        body.indexOf("createAdminClient()")
      );
      expect(body).toContain("ACCEPT_CLINIC_INVITE_COLUMNS");
      expect(body).not.toMatch(/\.select\(\s*["'`]\*/);
    }
    expect(ACCEPT_CLINIC_INVITE_COLUMNS).toContain("location_ids");
    expect(ACCEPT_CLINIC_INVITE_COLUMNS).toContain("invited_by");
    expect(ACCEPT_CLINIC_INVITE_COLUMNS).not.toContain("token");
  });
});
