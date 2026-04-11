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

export type CqcFetchError =
  | { kind: "not_found" }
  | { kind: "rate_limited"; retryAfterSeconds: number | null }
  | { kind: "network"; message: string }
  | { kind: "unexpected_status"; status: number; body: string };

export type CqcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: CqcFetchError };

/**
 * Fetch a provider by CQC provider ID (format: `1-xxxxxxxxxx`).
 * Returns the parsed record or a structured error. Never throws.
 */
export async function fetchCqcProvider(
  providerId: string,
  opts?: { signal?: AbortSignal }
): Promise<CqcResult<CqcProviderRecord>> {
  if (!/^[0-9]+-[0-9]+$/.test(providerId)) {
    return {
      ok: false,
      error: { kind: "not_found" },
    };
  }

  const url = `${CQC_API_BASE}/providers/${encodeURIComponent(providerId)}`;
  const res = await safeFetch(url, opts);
  if (!res.ok) return res;

  const json = res.data as CqcProviderApiResponse;
  return {
    ok: true,
    data: {
      providerId: json.providerId ?? providerId,
      name: json.name ?? "",
      registrationStatus: normaliseStatus(json.registrationStatus),
      registrationDate: json.registrationDate ?? null,
      deregistrationDate: json.deregistrationDate ?? null,
      type: json.type ?? null,
      brandId: json.brandId ?? null,
      locationIds:
        (json.locationIds ?? []).map((l) =>
          typeof l === "string" ? l : l.locationId
        ) ?? [],
      raw: json,
    },
  };
}

/**
 * Fetch a location by CQC location ID. Needed when a doctor declares a
 * specific registered location rather than just the owning provider.
 */
export async function fetchCqcLocation(
  locationId: string,
  opts?: { signal?: AbortSignal }
): Promise<CqcResult<CqcLocationRecord>> {
  if (!/^[0-9]+-[0-9]+$/.test(locationId)) {
    return { ok: false, error: { kind: "not_found" } };
  }

  const url = `${CQC_API_BASE}/locations/${encodeURIComponent(locationId)}`;
  const res = await safeFetch(url, opts);
  if (!res.ok) return res;

  const json = res.data as CqcLocationApiResponse;
  return {
    ok: true,
    data: {
      locationId: json.locationId ?? locationId,
      providerId: json.providerId ?? "",
      name: json.name ?? "",
      registrationStatus: normaliseStatus(json.registrationStatus),
      registrationDate: json.registrationDate ?? null,
      deregistrationDate: json.deregistrationDate ?? null,
      regulatedActivities:
        (json.regulatedActivities ?? [])
          .map((ra) => (typeof ra === "string" ? ra : ra.name))
          .filter((s): s is string => typeof s === "string" && s.length > 0),
      raw: json,
    },
  };
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

function normaliseStatus(s: string | undefined | null): CqcRegistrationStatus {
  if (!s) return "Unknown";
  const lower = s.toLowerCase();
  if (lower === "registered") return "Registered";
  if (lower === "deregistered") return "Deregistered";
  return "Unknown";
}

async function safeFetch<T = unknown>(
  url: string,
  opts?: { signal?: AbortSignal }
): Promise<CqcResult<T>> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MyDoctors360-compliance-bot/1.0",
      },
      signal: opts?.signal,
      // Cache the public CQC register for up to 6 hours on the edge.
      // The weekly cron is the authoritative refresher; individual admin
      // checks should be happy to hit the cache.
      next: { revalidate: 6 * 60 * 60 },
    });

    if (res.status === 404) {
      return { ok: false, error: { kind: "not_found" } };
    }
    if (res.status === 429) {
      const ra = res.headers.get("retry-after");
      const retryAfterSeconds = ra ? Number.parseInt(ra, 10) : null;
      return {
        ok: false,
        error: {
          kind: "rate_limited",
          retryAfterSeconds: Number.isFinite(retryAfterSeconds as number)
            ? (retryAfterSeconds as number)
            : null,
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

    const json = (await res.json()) as T;
    return { ok: true, data: json };
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "network",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
