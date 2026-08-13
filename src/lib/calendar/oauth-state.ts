import crypto from "crypto";

function stateSecret(): string {
  return (
    process.env.CALENDAR_OAUTH_STATE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

export function signCalendarOAuthState(payload: {
  userId: string;
  doctorId: string;
}): string {
  const secret = stateSecret();
  if (!secret) {
    throw new Error("Missing calendar OAuth state secret");
  }
  const body = Buffer.from(
    JSON.stringify({ ...payload, ts: Date.now() })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyCalendarOAuthState(
  raw: string
): { userId: string; doctorId: string } | null {
  const secret = stateSecret();
  if (!secret) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as {
      userId?: string;
      doctorId?: string;
    };
    if (!parsed.userId || !parsed.doctorId) return null;
    return { userId: parsed.userId, doctorId: parsed.doctorId };
  } catch {
    return null;
  }
}

export function googleChannelToken(channelId: string): string {
  const secret = stateSecret();
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(channelId).digest("hex");
}
