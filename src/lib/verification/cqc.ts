/**
 * Thin wrapper around the public CQC Syndication API.
 *
 * Used by the admin approval checklist and the weekly credentials cron to
 * verify a doctor's declared CQC provider/location ID against the live CQC
 * register. The API is public and does not require an API key — CQC
 * publishes it for exactly this purpose.
 *
 * Docs: https://www.cqc.org.uk/about-us/transparency/using-cqc-data
 * Base URL: https://api.service.cqc.org.uk/public/v1
 *
 * This module is deliberately read-only and has no side effects beyond
 * the outbound fetch. Caching of the result (to `doctors.cqc_verified_at`)
 * is the caller's responsibility — this module returns the raw truth.
 */

const CQC_API_BASE = "https://api.service.cqc.org.uk/public/v1";

export type CqcRegistrationStatus = "Registered" | "Deregistered" | "Unknown";

export type CqcProviderRecord = {
  providerId: string;
  name: string;
  registrationStatus: CqcRegistrationStatus;
  registrationDate: string | null;
  deregistrationDate: string | null;
  type: string | null; // e.g. "Healthcare"
  brandId: string | null;
  locationIds: string[];
  raw: unknown;
};

export type CqcLocationRecord = {
  locationId: string;
  providerId: string;
  name: string;
  registrationStatus: CqcRegistrationStatus;
  registrationDate: string | null;
  deregistrationDate: string | null;
  regulatedActivities: string[]; // e.g. ["Treatment of disease, disorder or injury"]
  raw: unknown;
};

/**
 * `not_found` is only a real HTTP 404 from the register for that id.
 * A locally invalid id, a timeout, a 429, a 5xx, or an unreadable body
 * must not use this kind — the credentials cron suspends on `not_found`.
 */
export type CqcFetchError =
  | { kind: "not_found"; status: 404 }
  | { kind: "invalid_id" }
  | { kind: "rate_limited"; status: 429; retryAfterSeconds: number | null }
  | { kind: "network"; message: string }
  | { kind: "malformed"; status: number; message: string }
  | { kind: "unexpected_status"; status: number; body: string };

export type CqcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: CqcFetchError };

const CQC_ID_RE = /^[0-9]+-[0-9]+$/;

/**
 * True only when the register answered HTTP 404 for that provider or
 * location id. Invalid ids and transport failures are not definitive.
 */
export function isDefinitiveCqcNotFound(error: CqcFetchError): boolean {
  return error.kind === "not_found" && error.status === 404;
}

/** HTTP status when the register responded; null for local or transport failures. */
export function cqcErrorHttpStatus(error: CqcFetchError): number | null {
  switch (error.kind) {
    case "not_found":
    case "rate_limited":
    case "unexpected_status":
    case "malformed":
      return error.status;
    case "invalid_id":
    case "network":
      return null;
  }
}

/**
 * Fetch a provider by CQC provider ID (format: `1-xxxxxxxxxx`).
 * Returns the parsed record or a structured error. Never throws.
 */
export async function fetchCqcProvider(
  providerId: string,
  opts?: { signal?: AbortSignal }
): Promise<CqcResult<CqcProviderRecord>> {
  if (!CQC_ID_RE.test(providerId)) {
    return { ok: false, error: { kind: "invalid_id" } };
  }

  const url = `${CQC_API_BASE}/providers/${encodeURIComponent(providerId)}`;
  const res = await safeFetch<CqcProviderApiResponse>(url, opts);
  if (!res.ok) return res;

  try {
    return { ok: true, data: mapProvider(res.data, providerId) };
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "malformed",
        status: 200,
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Fetch a location by CQC location ID. Needed when a doctor declares a
 * specific registered location rather than just the owning provider.
 */
export async function fetchCqcLocation(
  locationId: string,
  opts?: { signal?: AbortSignal }
): Promise<CqcResult<CqcLocationRecord>> {
  if (!CQC_ID_RE.test(locationId)) {
    return { ok: false, error: { kind: "invalid_id" } };
  }

  const url = `${CQC_API_BASE}/locations/${encodeURIComponent(locationId)}`;
  const res = await safeFetch<CqcLocationApiResponse>(url, opts);
  if (!res.ok) return res;

  try {
    return { ok: true, data: mapLocation(res.data, locationId) };
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "malformed",
        status: 200,
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}

/**
 * Build a link an admin can click to verify a CQC registration manually,
 * as a fallback when the Syndication API is unreachable or returns
 * ambiguous results.
 */
export function buildCqcSearchLink(query: string): string {
  const q = encodeURIComponent(query.trim());
  return `https://www.cqc.org.uk/search/services?q=${q}`;
}

// ─── internals ────────────────────────────────────────────────────────

type CqcProviderApiResponse = {
  providerId?: string;
  name?: string;
  registrationStatus?: string;
  registrationDate?: string;
  deregistrationDate?: string;
  type?: string;
  brandId?: string;
  locationIds?: Array<string | { locationId: string }>;
};

type CqcLocationApiResponse = {
  locationId?: string;
  providerId?: string;
  name?: string;
  registrationStatus?: string;
  registrationDate?: string;
  deregistrationDate?: string;
  regulatedActivities?: Array<string | { name?: string }>;
};

function normaliseStatus(s: unknown): CqcRegistrationStatus {
  if (typeof s !== "string" || !s) return "Unknown";
  const lower = s.toLowerCase();
  if (lower === "registered") return "Registered";
  if (lower === "deregistered") return "Deregistered";
  return "Unknown";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function mapProvider(
  json: CqcProviderApiResponse,
  providerId: string
): CqcProviderRecord {
  const locationIds = Array.isArray(json.locationIds)
    ? json.locationIds
        .map((l) => {
          if (typeof l === "string") return l;
          const row = asRecord(l);
          return row ? readString(row.locationId) : null;
        })
        .filter((id): id is string => !!id)
    : [];

  return {
    providerId: readString(json.providerId) ?? providerId,
    name: readString(json.name) ?? "",
    registrationStatus: normaliseStatus(json.registrationStatus),
    registrationDate: readString(json.registrationDate),
    deregistrationDate: readString(json.deregistrationDate),
    type: readString(json.type),
    brandId: readString(json.brandId),
    locationIds,
    raw: json,
  };
}

function mapLocation(
  json: CqcLocationApiResponse,
  locationId: string
): CqcLocationRecord {
  const regulatedActivities = Array.isArray(json.regulatedActivities)
    ? json.regulatedActivities
        .map((ra) => {
          if (typeof ra === "string") return ra;
          const row = asRecord(ra);
          return row ? readString(row.name) : null;
        })
        .filter((name): name is string => !!name && name.length > 0)
    : [];

  return {
    locationId: readString(json.locationId) ?? locationId,
    providerId: readString(json.providerId) ?? "",
    name: readString(json.name) ?? "",
    registrationStatus: normaliseStatus(json.registrationStatus),
    registrationDate: readString(json.registrationDate),
    deregistrationDate: readString(json.deregistrationDate),
    regulatedActivities,
    raw: json,
  };
}

async function safeFetch<T = unknown>(
  url: string,
  opts?: { signal?: AbortSignal }
): Promise<CqcResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MyDoctors360-compliance-bot/1.0",
      },
      signal: opts?.signal,
      // Cache the public CQC register for up to 6 hours on the edge.
      // The nightly credentials cron is the authoritative refresher;
      // individual admin checks should be happy to hit the cache.
      next: { revalidate: 6 * 60 * 60 },
    });
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "network",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }

  if (res.status === 404) {
    return { ok: false, error: { kind: "not_found", status: 404 } };
  }
  if (res.status === 429) {
    const ra = res.headers.get("retry-after");
    const parsed = ra ? Number.parseInt(ra, 10) : null;
    return {
      ok: false,
      error: {
        kind: "rate_limited",
        status: 429,
        retryAfterSeconds: Number.isFinite(parsed as number) ? parsed : null,
      },
    };
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      error: { kind: "unexpected_status", status: res.status, body },
    };
  }

  try {
    const json = (await res.json()) as T;
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      return {
        ok: false,
        error: {
          kind: "malformed",
          status: res.status,
          message: "CQC response was not a JSON object",
        },
      };
    }
    return { ok: true, data: json };
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "malformed",
        status: res.status,
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
