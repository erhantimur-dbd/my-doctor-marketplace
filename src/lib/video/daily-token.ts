/**
 * Server-only Daily meeting tokens.
 * The API key stays on the server. Tokens are returned to the caller and
 * must not be stored or written to logs.
 */

import "server-only";

import {
  DAILY_API_BASE,
  dailyAuthorizationHeader,
  setRoomPrivate,
} from "@/lib/daily/client";

export interface MintDailyMeetingTokenInput {
  roomName: string;
  userName: string;
  userId: string;
  /** True only for the assigned doctor's token. */
  isOwner: boolean;
  /** Unix seconds. */
  nbf: number;
  /** Unix seconds. */
  exp: number;
}

export function dailyMeetingJoinUrl(roomUrl: string, token: string): string {
  const url = new URL(roomUrl);
  url.searchParams.set("t", token);
  return url.toString();
}

/**
 * Lock the room, then mint a token scoped to that room.
 * Existing public rooms are updated in place before the token is issued.
 */
export async function mintDailyMeetingToken(
  input: MintDailyMeetingTokenInput
): Promise<string> {
  await setRoomPrivate(input.roomName);

  const response = await fetch(`${DAILY_API_BASE}/meeting-tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: dailyAuthorizationHeader(),
    },
    body: JSON.stringify({
      properties: {
        room_name: input.roomName,
        user_name: input.userName.slice(0, 128),
        user_id: input.userId,
        exp: input.exp,
        nbf: input.nbf,
        eject_at_token_exp: true,
        is_owner: input.isOwner,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Daily.co meeting token failed (${response.status})`);
  }

  const body = (await response.json()) as { token?: unknown };
  if (typeof body.token !== "string" || !body.token) {
    throw new Error("Daily.co meeting token missing");
  }
  return body.token;
}
