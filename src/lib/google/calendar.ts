/**
 * Google Calendar API client
 * Handles token refresh, list calendars, list events, create/delete events
 */

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO timestamp
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  primary?: boolean;
}

export interface GoogleEvent {
  id?: string;
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  status?: string;
}

function getClientId(): string {
  return process.env.GOOGLE_CLIENT_ID || "";
}

function getClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET || "";
}

function getRedirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/google/callback`;
}

/**
 * Generate the Google OAuth2 authorization URL
 */
export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${text}`);
  }

  return res.json();
}

/**
 * Refresh an expired access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: getClientId(),
      client_secret: getClientSecret(),
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${text}`);
  }

  return res.json();
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidAccessToken(tokens: GoogleTokens): Promise<{
  access_token: string;
  refreshed: boolean;
  new_expires_at?: string;
}> {
  const expiresAt = new Date(tokens.expires_at);
  const now = new Date();

  // Refresh if token expires within 5 minutes
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    const newExpiresAt = new Date(
      Date.now() + refreshed.expires_in * 1000
    ).toISOString();
    return {
      access_token: refreshed.access_token,
      refreshed: true,
      new_expires_at: newExpiresAt,
    };
  }

  return { access_token: tokens.access_token, refreshed: false };
}

/**
 * List the user's calendars
 */
export async function listCalendars(
  accessToken: string
): Promise<GoogleCalendar[]> {
  const res = await fetch(`${GOOGLE_CALENDAR_BASE}/users/me/calendarList`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to list calendars: ${res.status}`);
  }

  const data = await res.json();
  return (data.items || []).map(
    (cal: { id: string; summary: string; primary?: boolean }) => ({
      id: cal.id,
      summary: cal.summary,
      primary: cal.primary || false,
    })
  );
}

/**
 * List events from a calendar within a time range
 */
export async function listEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<GoogleEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "2500",
  });

  const res = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    throw new Error(`Failed to list events: ${res.status}`);
  }

  const data = await res.json();
  return (data.items || [])
    .filter((e: GoogleEvent) => e.status !== "cancelled")
    .map((e: { id: string; summary?: string; description?: string; start: { dateTime?: string; date?: string; timeZone?: string }; end: { dateTime?: string; date?: string; timeZone?: string } }) => ({
      id: e.id,
      summary: e.summary || "(No title)",
      description: e.description || "",
      start: { dateTime: e.start.dateTime || e.start.date || "", timeZone: e.start.timeZone },
      end: { dateTime: e.end.dateTime || e.end.date || "", timeZone: e.end.timeZone },
    }));
}

/**
 * Create an event in a calendar
 */
export async function createEvent(
  accessToken: string,
  calendarId: string,
  event: GoogleEvent
): Promise<GoogleEvent> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create event: ${text}`);
  }

  return res.json();
}

/**
 * Delete an event from a calendar
 */
export async function deleteEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  // 404 is fine — event may have already been deleted
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Failed to delete event: ${res.status}`);
  }
}

/**
 * Set up a push notification webhook for a calendar
 */
export async function watchCalendar(
  accessToken: string,
  calendarId: string,
  channelId: string,
  webhookUrl: string,
  expirationMs?: number
): Promise<{
  id: string;
  resourceId: string;
  expiration: string;
}> {
  const body: Record<string, unknown> = {
    id: channelId,
    type: "web_hook",
    address: webhookUrl,
  };

  if (expirationMs) {
    body.expiration = expirationMs;
  }

  const res = await fetch(
    `${GOOGLE_CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/watch`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to watch calendar: ${text}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    resourceId: data.resourceId,
    expiration: new Date(Number(data.expiration)).toISOString(),
  };
}

/**
 * Stop watching a calendar webhook channel
 */
export async function stopWatching(
  accessToken: string,
  channelId: string,
  resourceId: string
): Promise<void> {
  const res = await fetch(
    `${GOOGLE_CALENDAR_BASE}/channels/stop`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ id: channelId, resourceId }),
    }
  );

  // Ignore errors — channel may have already expired
  if (!res.ok && res.status !== 404) {
    console.warn(`Stop watching returned ${res.status}`);
  }
}
