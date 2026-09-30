/**
 * Daily.co REST API client for video room management.
 * No npm package needed — uses native fetch.
 *
 * Required env vars:
 *   DAILY_API_KEY  — API key from Daily.co dashboard
 */

import "server-only";

export const DAILY_API_BASE = "https://api.daily.co/v1";

function getApiKey(): string {
  const key = process.env.DAILY_API_KEY;
  if (!key) throw new Error("DAILY_API_KEY environment variable is not set");
  return key;
}

export function dailyAuthorizationHeader(): string {
  return `Bearer ${getApiKey()}`;
}

export interface CreateRoomOptions {
  /** Custom room name (e.g. "md-bk-20260224-a1b2"). Auto-generated if omitted. */
  name?: string;
  /** Unix timestamp (seconds) for auto-deletion of the room. */
  expiresAt: number;
  /** Max concurrent participants. Default 2 for 1:1 appointments. */
  maxParticipants?: number;
}

export interface DailyRoom {
  id: string;
  name: string;
  url: string;
  created_at: string;
  config: Record<string, unknown>;
}

/**
 * Create a new Daily.co video room.
 */
export async function createRoom(options: CreateRoomOptions): Promise<DailyRoom> {
  const response = await fetch(`${DAILY_API_BASE}/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      name: options.name,
      privacy: "private",
      properties: {
        exp: options.expiresAt,
        max_participants: options.maxParticipants ?? 2,
        enable_chat: true,
        // Knocking would let anyone with the URL ask to enter without a token.
        enable_knocking: false,
        enable_prejoin_ui: true,
        enable_screenshare: true,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Daily.co createRoom failed (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Fetch an existing Daily.co room by name.
 * Used when create hits "already exists" so a retry can still persist the URL.
 */
export async function getRoom(name: string): Promise<DailyRoom> {
  const response = await fetch(
    `${DAILY_API_BASE}/rooms/${encodeURIComponent(name)}`,
    {
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Daily.co getRoom failed (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Lock an existing room so the URL alone cannot admit anyone.
 *
 * Daily's set-room-config operation is POST /v1/rooms/:name. The REST API
 * does not implement PATCH for room privacy. Sending privacy "private" again
 * is idempotent.
 *
 * Knocking is turned off in the same call so a previously public room cannot
 * still be entered by requesting access.
 */
export async function setRoomPrivate(roomName: string): Promise<void> {
  const response = await fetch(
    `${DAILY_API_BASE}/rooms/${encodeURIComponent(roomName)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: dailyAuthorizationHeader(),
      },
      body: JSON.stringify({
        privacy: "private",
        properties: { enable_knocking: false },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Daily.co setRoomPrivate failed (${response.status})`);
  }
}

/**
 * Delete a Daily.co room by name. Used for cleanup on booking cancellation.
 */
export async function deleteRoom(roomName: string): Promise<void> {
  const response = await fetch(`${DAILY_API_BASE}/rooms/${roomName}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
    },
  });

  // 404 is OK — room may have already expired/been deleted
  if (!response.ok && response.status !== 404) {
    const error = await response.text();
    throw new Error(`Daily.co deleteRoom failed (${response.status}): ${error}`);
  }
}
