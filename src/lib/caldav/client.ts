/**
 * CalDAV client for Apple iCloud Calendar, Fastmail, Nextcloud, etc.
 * Uses the CalDAV protocol (RFC 4791) over HTTPS with basic auth or app-specific passwords.
 *
 * Unlike Google/Microsoft which use OAuth, CalDAV typically uses:
 * - Apple iCloud: app-specific password + apple ID email
 * - Fastmail: app password + email
 * - Nextcloud/Synology: username + password + server URL
 */

export interface CalDAVCredentials {
  serverUrl: string; // e.g., https://caldav.icloud.com or https://cloud.example.com/remote.php/dav
  username: string;
  password: string; // app-specific password
}

export interface CalDAVCalendar {
  href: string; // calendar path
  displayName: string;
  ctag?: string;
}

export interface CalDAVEvent {
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string;
  href: string;
}

// Known CalDAV server URLs for common providers
export const CALDAV_PROVIDERS = {
  apple: {
    name: "Apple iCloud",
    serverUrl: "https://caldav.icloud.com",
    helpText: "Use your Apple ID email and an app-specific password. Generate one at appleid.apple.com > Sign-In and Security > App-Specific Passwords.",
  },
  fastmail: {
    name: "Fastmail",
    serverUrl: "https://caldav.fastmail.com/dav/calendars",
    helpText: "Use your Fastmail email and an app password from Settings > Privacy & Security > Integrations.",
  },
  nextcloud: {
    name: "Nextcloud",
    serverUrl: "", // user must provide
    helpText: "Enter your Nextcloud server URL (e.g., https://cloud.example.com/remote.php/dav). Use your Nextcloud username and password.",
  },
  other: {
    name: "Other CalDAV",
    serverUrl: "",
    helpText: "Enter your CalDAV server URL, username, and password. Check your provider's documentation for details.",
  },
} as const;

export type CalDAVProvider = keyof typeof CALDAV_PROVIDERS;

/**
 * Build the Authorization header for Basic Auth
 */
function authHeader(username: string, password: string): string {
  const encoded = Buffer.from(`${username}:${password}`).toString("base64");
  return `Basic ${encoded}`;
}

/**
 * Discover the principal URL for the user (CalDAV standard)
 */
async function discoverPrincipal(
  serverUrl: string,
  username: string,
  password: string
): Promise<string> {
  const res = await fetch(serverUrl, {
    method: "PROPFIND",
    headers: {
      Authorization: authHeader(username, password),
      "Content-Type": "application/xml; charset=utf-8",
      Depth: "0",
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal/>
  </d:prop>
</d:propfind>`,
  });

  if (!res.ok) {
    throw new Error(`CalDAV discovery failed (${res.status}): ${res.statusText}`);
  }

  const text = await res.text();
  // Extract principal href from XML
  const match = text.match(/<[^:]*:?href[^>]*>([^<]+)<\/[^:]*:?href>/);
  if (match) return match[1];

  // Fallback: try the serverUrl itself as principal
  return serverUrl;
}

/**
 * Discover calendar home set from principal
 */
async function discoverCalendarHome(
  serverUrl: string,
  principalPath: string,
  username: string,
  password: string
): Promise<string> {
  const baseUrl = new URL(serverUrl);
  const principalUrl = principalPath.startsWith("http")
    ? principalPath
    : `${baseUrl.origin}${principalPath}`;

  const res = await fetch(principalUrl, {
    method: "PROPFIND",
    headers: {
      Authorization: authHeader(username, password),
      "Content-Type": "application/xml; charset=utf-8",
      Depth: "0",
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-home-set/>
  </d:prop>
</d:propfind>`,
  });

  if (!res.ok) {
    throw new Error(`Calendar home discovery failed (${res.status})`);
  }

  const text = await res.text();
  const match = text.match(/<[^:]*:?href[^>]*>([^<]+)<\/[^:]*:?href>/g);

  // Find the calendar-home-set href (usually the second one)
  if (match && match.length > 1) {
    const hrefMatch = match[match.length - 1].match(/>([^<]+)</);
    if (hrefMatch) return hrefMatch[1];
  }

  return principalPath;
}

/**
 * List calendars from the calendar home
 */
export async function listCalendars(
  credentials: CalDAVCredentials
): Promise<CalDAVCalendar[]> {
  const { serverUrl, username, password } = credentials;

  // Discover principal → calendar home
  const principalPath = await discoverPrincipal(serverUrl, username, password);
  const calendarHome = await discoverCalendarHome(
    serverUrl,
    principalPath,
    username,
    password
  );

  const baseUrl = new URL(serverUrl);
  const homeUrl = calendarHome.startsWith("http")
    ? calendarHome
    : `${baseUrl.origin}${calendarHome}`;

  const res = await fetch(homeUrl, {
    method: "PROPFIND",
    headers: {
      Authorization: authHeader(username, password),
      "Content-Type": "application/xml; charset=utf-8",
      Depth: "1",
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
    <cs:getctag/>
  </d:prop>
</d:propfind>`,
  });

  if (!res.ok) {
    throw new Error(`Failed to list calendars (${res.status})`);
  }

  const text = await res.text();
  const calendars: CalDAVCalendar[] = [];

  // Parse multi-status response — extract responses that have a calendar resourcetype
  const responses = text.split(/<[^:]*:?response[^>]*>/g).slice(1);

  for (const response of responses) {
    // Check if this is a calendar (has <cal:calendar/> in resourcetype)
    if (!response.match(/calendar/i)) continue;

    const hrefMatch = response.match(/<[^:]*:?href[^>]*>([^<]+)</);
    const nameMatch = response.match(/<[^:]*:?displayname[^>]*>([^<]*)</);

    if (hrefMatch) {
      calendars.push({
        href: hrefMatch[1],
        displayName: nameMatch?.[1] || "Calendar",
      });
    }
  }

  return calendars;
}

/**
 * Fetch events from a CalDAV calendar within a time range
 */
export async function listEvents(
  credentials: CalDAVCredentials,
  calendarHref: string,
  timeMin: string,
  timeMax: string
): Promise<CalDAVEvent[]> {
  const { serverUrl, username, password } = credentials;
  const baseUrl = new URL(serverUrl);
  const calUrl = calendarHref.startsWith("http")
    ? calendarHref
    : `${baseUrl.origin}${calendarHref}`;

  // Format dates for CalDAV (YYYYMMDDTHHMMSSZ)
  const startUtc = new Date(timeMin).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const endUtc = new Date(timeMax).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const res = await fetch(calUrl, {
    method: "REPORT",
    headers: {
      Authorization: authHeader(username, password),
      "Content-Type": "application/xml; charset=utf-8",
      Depth: "1",
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <d:getetag/>
    <c:calendar-data/>
  </d:prop>
  <c:filter>
    <c:comp-filter name="VCALENDAR">
      <c:comp-filter name="VEVENT">
        <c:time-range start="${startUtc}" end="${endUtc}"/>
      </c:comp-filter>
    </c:comp-filter>
  </c:filter>
</c:calendar-query>`,
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch events (${res.status})`);
  }

  const text = await res.text();
  const events: CalDAVEvent[] = [];

  // Parse each response and extract iCalendar data
  const responses = text.split(/<[^:]*:?response[^>]*>/g).slice(1);

  for (const response of responses) {
    const hrefMatch = response.match(/<[^:]*:?href[^>]*>([^<]+)</);
    const dataMatch = response.match(/<[^:]*:?calendar-data[^>]*>([\s\S]*?)<\/[^:]*:?calendar-data>/);

    if (!hrefMatch || !dataMatch) continue;

    const ical = dataMatch[1];

    // Parse basic iCalendar fields
    const uidMatch = ical.match(/UID:(.+)/);
    const summaryMatch = ical.match(/SUMMARY:(.+)/);
    const dtstartMatch = ical.match(/DTSTART[^:]*:(\S+)/);
    const dtendMatch = ical.match(/DTEND[^:]*:(\S+)/);

    if (uidMatch && dtstartMatch) {
      events.push({
        uid: uidMatch[1].trim(),
        summary: summaryMatch?.[1]?.trim() || "Busy",
        dtstart: dtstartMatch[1].trim(),
        dtend: dtendMatch?.[1]?.trim() || dtstartMatch[1].trim(),
        href: hrefMatch[1],
      });
    }
  }

  return events;
}

/**
 * Create an event in a CalDAV calendar
 */
export async function createEvent(
  credentials: CalDAVCredentials,
  calendarHref: string,
  event: {
    uid: string;
    summary: string;
    description?: string;
    dtstart: Date;
    dtend: Date;
    timezone?: string;
  }
): Promise<void> {
  const { serverUrl, username, password } = credentials;
  const baseUrl = new URL(serverUrl);
  const eventUrl = calendarHref.startsWith("http")
    ? `${calendarHref}${event.uid}.ics`
    : `${baseUrl.origin}${calendarHref}${event.uid}.ics`;

  const formatDate = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

  const ical = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MyDoctors360//CalDAV//EN",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${formatDate(new Date())}`,
    `DTSTART:${formatDate(event.dtstart)}`,
    `DTEND:${formatDate(event.dtend)}`,
    `SUMMARY:${event.summary.replace(/[,;\\]/g, "\\$&")}`,
    event.description
      ? `DESCRIPTION:${event.description.replace(/\n/g, "\\n").replace(/[,;\\]/g, "\\$&")}`
      : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  const res = await fetch(eventUrl, {
    method: "PUT",
    headers: {
      Authorization: authHeader(username, password),
      "Content-Type": "text/calendar; charset=utf-8",
      "If-None-Match": "*",
    },
    body: ical,
  });

  // 201 Created or 204 No Content are both success
  if (!res.ok && res.status !== 201 && res.status !== 204) {
    throw new Error(`Failed to create event (${res.status})`);
  }
}

/**
 * Delete an event from a CalDAV calendar
 */
export async function deleteEvent(
  credentials: CalDAVCredentials,
  eventHref: string
): Promise<void> {
  const { serverUrl, username, password } = credentials;
  const baseUrl = new URL(serverUrl);
  const eventUrl = eventHref.startsWith("http")
    ? eventHref
    : `${baseUrl.origin}${eventHref}`;

  const res = await fetch(eventUrl, {
    method: "DELETE",
    headers: {
      Authorization: authHeader(username, password),
    },
  });

  // Ignore 404 (already deleted)
  if (!res.ok && res.status !== 404) {
    throw new Error(`Failed to delete event (${res.status})`);
  }
}

/**
 * Test a CalDAV connection by attempting to list calendars
 */
export async function testConnection(
  credentials: CalDAVCredentials
): Promise<{ success: boolean; calendars: CalDAVCalendar[]; error?: string }> {
  try {
    const calendars = await listCalendars(credentials);
    return { success: true, calendars };
  } catch (err) {
    return {
      success: false,
      calendars: [],
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}
