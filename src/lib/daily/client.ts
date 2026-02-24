/**
 * Daily.co REST API client for video room management.
 * No npm package needed — uses native fetch.
 *
 * Required env vars:
 *   DAILY_API_KEY  — API key from Daily.co dashboard
 */

const DAILY_API_BASE = "https://api.daily.co/v1";

function getApiKey(): string {
  const key = process.env.DAILY_API_KEY;
  if (!key) throw new Error("DAILY_API_KEY environment variable is not set");
  return key;
}

interface CreateRoomOptions {
  /** Custom room name (e.g. "md-bk-20260224-a1b2"). Auto-generated if omitted. */
  name?: string;
  /** Unix timestamp (seconds) for auto-deletion of the room. */
  expiresAt: number;
  /** Max concurrent participants. Default 2 for 1:1 appointments. */
  maxParticipants?: number;
}

interface DailyRoom {
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
      privacy: "public", // Link-based access, no tokens needed
      properties: {
        exp: options.expiresAt,
        max_participants: options.maxParticipants ?? 2,
        enable_chat: true,
        enable_knocking: true,
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
