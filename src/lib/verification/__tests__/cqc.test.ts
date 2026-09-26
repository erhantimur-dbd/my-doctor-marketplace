import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchCqcProvider,
  isDefinitiveCqcNotFound,
} from "@/lib/verification/cqc";

const fetchMock = vi.fn();

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function jsonResponse(
  status: number,
  body: unknown,
  headers?: Record<string, string>
): Response {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(payload, {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("fetchCqcProvider error classification", () => {
  it("treats only an HTTP 404 as a definitive not-found", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      jsonResponse(404, { message: "Provider not found" })
    );

    const result = await fetchCqcProvider("1-9999999999");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({ kind: "not_found", status: 404 });
      expect(isDefinitiveCqcNotFound(result.error)).toBe(true);
    }
  });

  it("does not classify an invalid id as not-found and does not call the register", async () => {
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchCqcProvider("not-a-real-id");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, error: { kind: "invalid_id" } });
    if (!result.ok) expect(isDefinitiveCqcNotFound(result.error)).toBe(false);
  });

  it("classifies a timeout as network", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockRejectedValue(
      new DOMException("The operation was aborted", "AbortError")
    );

    const result = await fetchCqcProvider("1-1234567890");

    expect(result).toEqual({
      ok: false,
      error: { kind: "network", message: "The operation was aborted" },
    });
    if (!result.ok) expect(isDefinitiveCqcNotFound(result.error)).toBe(false);
  });

  it("classifies HTTP 429 as rate_limited", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      jsonResponse(429, "slow down", { "retry-after": "30" })
    );

    const result = await fetchCqcProvider("1-1234567890");

    expect(result).toEqual({
      ok: false,
      error: { kind: "rate_limited", status: 429, retryAfterSeconds: 30 },
    });
  });

  it("classifies HTTP 5xx as unexpected_status, not not-found", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse(503, "unavailable"));

    const result = await fetchCqcProvider("1-1234567890");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("unexpected_status");
      if (result.error.kind === "unexpected_status") {
        expect(result.error.status).toBe(503);
      }
      expect(isDefinitiveCqcNotFound(result.error)).toBe(false);
    }
  });

  it("classifies an unreadable body as malformed", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(jsonResponse(200, "<html>not json</html>"));

    const result = await fetchCqcProvider("1-1234567890");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("malformed");
      expect(isDefinitiveCqcNotFound(result.error)).toBe(false);
    }
  });

  it("parses a deregistered provider without suspending-class errors", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        providerId: "1-1234567890",
        name: "Example Care",
        registrationStatus: "Deregistered",
      })
    );

    const result = await fetchCqcProvider("1-1234567890");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.registrationStatus).toBe("Deregistered");
    }
  });

  it("treats a non-string registration status as Unknown", async () => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue(
      jsonResponse(200, { registrationStatus: 12, name: "Example" })
    );

    const result = await fetchCqcProvider("1-1234567890");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.registrationStatus).toBe("Unknown");
  });
});
