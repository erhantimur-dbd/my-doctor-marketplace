/**
 * Microsoft Graph Calendar API client
 * Handles OAuth2, token refresh, list calendars, list/create/delete events
 * Mirrors the Google Calendar client pattern.
 */

const MS_AUTH_BASE = "https://login.microsoftonline.com/common/oauth2/v2.0";
const MS_GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export interface MicrosoftTokens {
  access_token: string;
  refresh_token: string;
  expires_at: string; // ISO timestamp
}

export interface MicrosoftCalendar {
  id: string;
  name: string;
  isDefaultCalendar?: boolean;
}

export interface MicrosoftEvent {
  id?: string;
  subject: string;
  body?: { contentType: string; content: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}

function getClientId(): string {
  return process.env.MICROSOFT_CLIENT_ID || "";
}

function getClientSecret(): string {
  return process.env.MICROSOFT_CLIENT_SECRET || "";
}

function getRedirectUri(): string {
  return (
    process.env.MICROSOFT_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/microsoft/callback`
  );
}

/**
 * Generate the Microsoft OAuth2 authorization URL
 */
export function getMicrosoftAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope:
      "openid offline_access Calendars.ReadWrite",
    state,
    prompt: "consent",
  });

  return `${MS_AUTH_BASE}/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(`${MS_AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      code,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Microsoft token exchange failed: ${err}`);
  }

  return res.json();
}

/**
 * Refresh an access token using the refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const res = await fetch(`${MS_AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: "openid offline_access Calendars.ReadWrite",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Microsoft token refresh failed: ${err}`);
  }

  return res.json();
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidAccessToken(tokens: MicrosoftTokens): Promise<{
  access_token: string;
  refreshed: boolean;
  new_expires_at?: string;
  new_refresh_token?: string;
}> {
  const expiresAt = new Date(tokens.expires_at).getTime();
  const now = Date.now();

  // Refresh if token expires within 5 minutes
  if (expiresAt - now > 5 * 60 * 1000) {
    return { access_token: tokens.access_token, refreshed: false };
  }

  const refreshed = await refreshAccessToken(tokens.refresh_token);
  const newExpiresAt = new Date(
    Date.now() + refreshed.expires_in * 1000
  ).toISOString();

  return {
    access_token: refreshed.access_token,
    refreshed: true,
    new_expires_at: newExpiresAt,
    new_refresh_token: refreshed.refresh_token,
  };
}

/**
 * List user's calendars
 */
export async function listCalendars(
  accessToken: string
): Promise<MicrosoftCalendar[]> {
  const res = await fetch(`${MS_GRAPH_BASE}/me/calendars`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) throw new Error(`Failed to list calendars: ${res.statusText}`);

  const data = await res.json();
  return (data.value || []).map((cal: any) => ({
    id: cal.id,
    name: cal.name,
    isDefaultCalendar: cal.isDefaultCalendar,
  }));
}

/**
 * List events from a calendar within a time range
 */
export async function listEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<MicrosoftEvent[]> {
  const params = new URLSearchParams({
    startDateTime: timeMin,
    endDateTime: timeMax,
    $top: "500",
    $select: "id,subject,start,end,isCancelled",
    $filter: "isCancelled eq false",
  });

  const res = await fetch(
    `${MS_GRAPH_BASE}/me/calendars/${calendarId}/calendarView?${params.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' } }
  );

  if (!res.ok) throw new Error(`Failed to list events: ${res.statusText}`);

  const data = await res.json();
  return (data.value || []).map((ev: any) => ({
    id: ev.id,
    subject: ev.subject,
    start: ev.start,
    end: ev.end,
  }));
}

/**
 * Create an event in a calendar
 */
export async function createEvent(
  accessToken: string,
  calendarId: string,
  event: MicrosoftEvent
): Promise<MicrosoftEvent> {
  const res = await fetch(
    `${MS_GRAPH_BASE}/me/calendars/${calendarId}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  if (!res.ok) throw new Error(`Failed to create event: ${res.statusText}`);

  return res.json();
}

/**
 * Delete an event from a calendar
 */
export async function deleteEvent(
  accessToken: string,
  eventId: string
): Promise<void> {
  const res = await fetch(`${MS_GRAPH_BASE}/me/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // Ignore 404 (already deleted)
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete event: ${res.statusText}`);
  }
}

/**
 * Create a webhook subscription for calendar changes
 */
export async function createSubscription(
  accessToken: string,
  calendarId: string,
  webhookUrl: string
): Promise<{ id: string; expirationDateTime: string }> {
  // Microsoft subscriptions max 3 days for calendars
  const expiration = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

  const res = await fetch(`${MS_GRAPH_BASE}/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      changeType: "created,updated,deleted",
      notificationUrl: webhookUrl,
      resource: `/me/calendars/${calendarId}/events`,
      expirationDateTime: expiration,
      clientState: "mydoctors360-calendar-sync",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create subscription: ${err}`);
  }

  const data = await res.json();
  return { id: data.id, expirationDateTime: data.expirationDateTime };
}

/**
 * Delete a webhook subscription
 */
export async function deleteSubscription(
  accessToken: string,
  subscriptionId: string
): Promise<void> {
  const res = await fetch(`${MS_GRAPH_BASE}/subscriptions/${subscriptionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete subscription: ${res.statusText}`);
  }
}
