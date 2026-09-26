/**
 * One-time manage links for a booking found by number + email.
 * The raw token is emailed. Only its hash is stored. A change to the
 * booking (opening the existing manage flow) consumes the token once.
 */

import { createHash, randomBytes } from "node:crypto";

export const MANAGE_TOKEN_TTL_MS = 30 * 60 * 1000;

export const MANAGE_TOKEN_REQUIRED =
  "A one-time manage link is required to change this booking.";

export const MANAGE_TOKEN_INVALID =
  "This link is invalid or has already been used.";

export type ManageTokenRecord = {
  bookingId: string;
  expiresAt: number;
  usedAt: number | null;
};

export interface ManageTokenStore {
  put(hash: string, record: ManageTokenRecord): Promise<void>;
  get(hash: string): Promise<ManageTokenRecord | null>;
  /** Marks the token used. Returns null if missing, expired, or already used. */
  consume(hash: string, now: number): Promise<ManageTokenRecord | null>;
}

export function hashManageToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function issueManageToken(input: {
  bookingId: string;
  now: number;
}): { token: string; hash: string; record: ManageTokenRecord } {
  const token = randomBytes(32).toString("base64url");
  const record: ManageTokenRecord = {
    bookingId: input.bookingId,
    expiresAt: input.now + MANAGE_TOKEN_TTL_MS,
    usedAt: null,
  };
  return { token, hash: hashManageToken(token), record };
}

export function assessManageToken(
  record: ManageTokenRecord | null,
  now: number
): "valid" | "missing" | "used" | "expired" {
  if (!record) return "missing";
  if (record.usedAt != null) return "used";
  if (record.expiresAt <= now) return "expired";
  return "valid";
}

export function manageLinkUrl(
  origin: string,
  locale: string,
  token: string
): string {
  const base = origin.replace(/\/$/, "");
  return `${base}/${locale}/find-booking/manage?token=${encodeURIComponent(token)}`;
}

/**
 * Booking changes from the public lookup path require a live emailed token.
 * Consumes the token so it cannot authorise a second change.
 */
export async function authorizeBookingChange(input: {
  token: string | null | undefined;
  bookingId?: string | null;
  store: ManageTokenStore;
  now: number;
}): Promise<
  { ok: true; bookingId: string } | { ok: false; error: string }
> {
  const token = input.token?.trim();
  if (!token) return { ok: false, error: MANAGE_TOKEN_REQUIRED };

  const hash = hashManageToken(token);
  const existing = await input.store.get(hash);
  if (assessManageToken(existing, input.now) !== "valid" || !existing) {
    return { ok: false, error: MANAGE_TOKEN_INVALID };
  }
  if (input.bookingId && existing.bookingId !== input.bookingId) {
    return { ok: false, error: MANAGE_TOKEN_INVALID };
  }

  const consumed = await input.store.consume(hash, input.now);
  if (!consumed) return { ok: false, error: MANAGE_TOKEN_INVALID };
  return { ok: true, bookingId: consumed.bookingId };
}

export class MemoryManageTokenStore implements ManageTokenStore {
  private rows = new Map<string, ManageTokenRecord>();

  async put(hash: string, record: ManageTokenRecord): Promise<void> {
    this.rows.set(hash, { ...record });
  }

  async get(hash: string): Promise<ManageTokenRecord | null> {
    const row = this.rows.get(hash);
    return row ? { ...row } : null;
  }

  async consume(
    hash: string,
    now: number
  ): Promise<ManageTokenRecord | null> {
    const row = this.rows.get(hash);
    if (!row || row.usedAt != null || row.expiresAt <= now) return null;
    row.usedAt = now;
    return { ...row };
  }
}
