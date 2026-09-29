export type MfaRestFailureReason =
  | "config"
  | "session"
  | "challenge"
  | "verify"
  | "unenroll"
  | "network";

export type MfaVerifySuccess = {
  ok: true;
  accessToken: string;
  refreshToken: string;
};

export type MfaRestFailure = {
  ok: false;
  reason: MfaRestFailureReason;
};

async function authHeaders(accessToken: string): Promise<
  | { ok: true; url: string; headers: Record<string, string> }
  | MfaRestFailure
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { ok: false, reason: "config" };
  if (!accessToken) return { ok: false, reason: "session" };
  return {
    ok: true,
    url,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      apikey: anon,
    },
  };
}

/**
 * Challenge + verify a TOTP factor via GoTrue REST.
 * Avoids supabase-js session persist (NavigatorLock contention with @supabase/ssr).
 */
export async function challengeAndVerifyTotp(input: {
  factorId: string;
  accessToken: string;
  code: string;
}): Promise<MfaVerifySuccess | MfaRestFailure> {
  const auth = await authHeaders(input.accessToken);
  if (!auth.ok) return auth;

  try {
    const challengeRes = await fetch(
      `${auth.url}/auth/v1/factors/${encodeURIComponent(input.factorId)}/challenge`,
      { method: "POST", headers: auth.headers }
    );
    if (!challengeRes.ok) return { ok: false, reason: "challenge" };

    const challengeData = (await challengeRes.json()) as { id?: string };
    if (!challengeData.id) return { ok: false, reason: "challenge" };

    const verifyRes = await fetch(
      `${auth.url}/auth/v1/factors/${encodeURIComponent(input.factorId)}/verify`,
      {
        method: "POST",
        headers: auth.headers,
        body: JSON.stringify({
          challenge_id: challengeData.id,
          code: input.code,
        }),
      }
    );
    if (!verifyRes.ok) return { ok: false, reason: "verify" };

    const verifyData = (await verifyRes.json()) as {
      access_token?: string;
      refresh_token?: string;
    };
    if (!verifyData.access_token || !verifyData.refresh_token) {
      return { ok: false, reason: "verify" };
    }

    return {
      ok: true,
      accessToken: verifyData.access_token,
      refreshToken: verifyData.refresh_token,
    };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export async function unenrollMfaFactor(input: {
  factorId: string;
  accessToken: string;
}): Promise<{ ok: true } | MfaRestFailure> {
  const auth = await authHeaders(input.accessToken);
  if (!auth.ok) return auth;

  try {
    const res = await fetch(
      `${auth.url}/auth/v1/factors/${encodeURIComponent(input.factorId)}`,
      { method: "DELETE", headers: auth.headers }
    );
    if (!res.ok) return { ok: false, reason: "unenroll" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "network" };
  }
}

export function mfaFailureMessage(
  reason: MfaRestFailureReason,
  t: (key: string) => string
): string {
  switch (reason) {
    case "session":
      return t("error_session_expired");
    case "challenge":
      return t("error_challenge_failed");
    case "verify":
      return t("error_invalid_code");
    case "unenroll":
      return t("error_unenroll_failed");
    case "network":
    case "config":
    default:
      return t("error_generic");
  }
}
