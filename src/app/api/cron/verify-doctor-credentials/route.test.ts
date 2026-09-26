import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { fetchCqcProvider } from "@/lib/verification/cqc";
import { log } from "@/lib/utils/logger";
import { SOFT_LAUNCH_SOFTSMOKE_DOCTOR } from "@/lib/soft-launch/softsmoke-connect-bypass";
import { AUDIT_SYSTEM_ACTOR_ENV } from "@/lib/audit/system-actor";
import { GET } from "./route";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => clientRef.current,
}));

vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/lib/verification/cqc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/verification/cqc")>(
    "@/lib/verification/cqc"
  );
  return {
    ...actual,
    fetchCqcProvider: vi.fn(),
  };
});

vi.mock("@/lib/utils/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const clientRef = vi.hoisted(() => ({
  current: null as { from: (table: string) => unknown } | null,
}));

const ACTOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ADMIN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const DOCTOR = "11111111-1111-4111-8111-111111111111";
const PROVIDER = "1-1234567890";
const DUMMY_PROVIDER = "1-9999999999";

type DoctorRow = {
  id: string;
  profile_id: string;
  verification_status: string;
  cqc_status: string | null;
  cqc_provider_id: string | null;
  indemnity_insurer: string | null;
  indemnity_expiry: string | null;
  dbs_check_date: string | null;
  profile: { first_name: string; last_name: string; email: string };
};

type Update = {
  table: string;
  payload: Record<string, unknown>;
  filters: Array<[string, unknown]>;
};

type Insert = {
  table: string;
  payload: Record<string, unknown>;
};

const state = {
  doctors: [] as DoctorRow[],
  updates: [] as Update[],
  inserts: [] as Insert[],
  adminProfile: null as { id: string } | null,
};

const envBackup = {
  cron: process.env.CRON_SECRET,
  actor: process.env[AUDIT_SYSTEM_ACTOR_ENV],
  skip: process.env.SOFT_LAUNCH_SOFTSMOKE_CREDENTIALS_SKIP,
};

function doctor(overrides: Partial<DoctorRow> = {}): DoctorRow {
  return {
    id: DOCTOR,
    profile_id: "22222222-2222-4222-8222-222222222222",
    verification_status: "approved",
    cqc_status: "registered",
    cqc_provider_id: PROVIDER,
    indemnity_insurer: "MDU",
    indemnity_expiry: null,
    dbs_check_date: null,
    profile: {
      first_name: "Ada",
      last_name: "Lovelace",
      email: "ada@example.com",
    },
    ...overrides,
  };
}

function chain(table: string, action: "select" | "update", payload?: Record<string, unknown>) {
  const filters: Array<[string, unknown]> = [];
  const api = {
    select() {
      return api;
    },
    eq(col: string, val: unknown) {
      filters.push([col, val]);
      return api;
    },
    order() {
      return api;
    },
    limit() {
      return api;
    },
    update(next: Record<string, unknown>) {
      return chain(table, "update", next);
    },
    insert(row: Record<string, unknown>) {
      state.inserts.push({ table, payload: row });
      return Promise.resolve({ error: null });
    },
    maybeSingle: async () => {
      if (table === "profiles") {
        const idFilter = filters.find(([col]) => col === "id");
        if (idFilter) {
          return {
            data: idFilter[1] === state.adminProfile?.id ? state.adminProfile : null,
            error: null,
          };
        }
        return { data: state.adminProfile, error: null };
      }
      return { data: null, error: null };
    },
    then(
      onFulfilled: (value: { data: unknown; error: null }) => unknown,
      onRejected?: (reason: unknown) => unknown
    ) {
      if (action === "update") {
        state.updates.push({ table, payload: payload ?? {}, filters: [...filters] });
        return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
      }
      const data = table === "doctors" ? state.doctors : null;
      return Promise.resolve({ data, error: null }).then(onFulfilled, onRejected);
    },
  };
  return api;
}

function installClient() {
  clientRef.current = {
    from(table: string) {
      return chain(table, "select");
    },
  };
}

function cronRequest() {
  return new NextRequest(
    "http://localhost/api/cron/verify-doctor-credentials",
    { headers: { authorization: "Bearer test-cron-secret" } }
  );
}

function suspensionUpdates() {
  return state.updates.filter(
    (update) =>
      update.table === "doctors" &&
      update.payload.verification_status === "suspended"
  );
}

function verifiedAtUpdates() {
  return state.updates.filter(
    (update) => update.table === "doctors" && "cqc_verified_at" in update.payload
  );
}

function auditInserts() {
  return state.inserts.filter((insert) => insert.table === "audit_log");
}

beforeEach(() => {
  state.doctors = [];
  state.updates = [];
  state.inserts = [];
  state.adminProfile = null;
  process.env.CRON_SECRET = "test-cron-secret";
  process.env[AUDIT_SYSTEM_ACTOR_ENV] = ACTOR;
  delete process.env.SOFT_LAUNCH_SOFTSMOKE_CREDENTIALS_SKIP;
  installClient();
  vi.mocked(fetchCqcProvider).mockReset();
  vi.mocked(log.info).mockClear();
  vi.mocked(log.warn).mockClear();
  vi.mocked(log.error).mockClear();
});

afterEach(() => {
  if (envBackup.cron === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = envBackup.cron;
  if (envBackup.actor === undefined) delete process.env[AUDIT_SYSTEM_ACTOR_ENV];
  else process.env[AUDIT_SYSTEM_ACTOR_ENV] = envBackup.actor;
  if (envBackup.skip === undefined) {
    delete process.env.SOFT_LAUNCH_SOFTSMOKE_CREDENTIALS_SKIP;
  } else {
    process.env.SOFT_LAUNCH_SOFTSMOKE_CREDENTIALS_SKIP = envBackup.skip;
  }
});

describe("verify-doctor-credentials", () => {
  it("suspends and audits when the register says deregistered", async () => {
    vi.mocked(fetchCqcProvider).mockResolvedValue({
      ok: true,
      data: {
        providerId: PROVIDER,
        name: "Example",
        registrationStatus: "Deregistered",
        registrationDate: null,
        deregistrationDate: "2026-01-01",
        type: null,
        brandId: null,
        locationIds: [],
        raw: {},
      },
    });
    state.doctors = [doctor()];

    const response = await GET(cronRequest());
    const body = await response.json();

    expect(body.cqc_suspended).toBe(1);
    expect(suspensionUpdates()).toHaveLength(1);
    expect(auditInserts()).toEqual([
      {
        table: "audit_log",
        payload: expect.objectContaining({
          actor_id: ACTOR,
          action: "doctor_auto_suspended",
          target_type: "doctor",
          target_id: DOCTOR,
          metadata: expect.objectContaining({
            reason: expect.stringContaining("deregistered"),
            cqc_provider_id: PROVIDER,
            register_response: {
              http_status: 200,
              registration_status: "Deregistered",
              error_kind: null,
            },
            actor_kind: "system",
          }),
        }),
      },
    ]);
  });

  it("suspends and audits a definitive HTTP 404 not-found", async () => {
    vi.mocked(fetchCqcProvider).mockResolvedValue({
      ok: false,
      error: { kind: "not_found", status: 404 },
    });
    state.doctors = [doctor({ cqc_provider_id: DUMMY_PROVIDER })];

    await GET(cronRequest());

    expect(suspensionUpdates()).toHaveLength(1);
    const audit = auditInserts()[0]?.payload;
    expect(audit).toMatchObject({
      actor_id: ACTOR,
      action: "doctor_auto_suspended",
      target_type: "doctor",
      target_id: DOCTOR,
    });
    expect(audit?.metadata).toMatchObject({
      cqc_provider_id: DUMMY_PROVIDER,
      register_response: {
        http_status: 404,
        registration_status: null,
        error_kind: "not_found",
      },
    });
    expect((audit?.metadata as { reason: string }).reason).toContain("404");
  });

  it.each([
    ["timeout", { kind: "network" as const, message: "The operation was aborted" }, "network"],
    ["429", { kind: "rate_limited" as const, status: 429 as const, retryAfterSeconds: 12 }, "rate_limited"],
    ["5xx", { kind: "unexpected_status" as const, status: 503, body: "unavailable" }, "unexpected_status"],
    ["malformed", { kind: "malformed" as const, status: 200, message: "Unexpected token" }, "malformed"],
  ])(
    "does not suspend on %s and logs a warning",
    async (_label, error, errorKind) => {
      vi.mocked(fetchCqcProvider).mockResolvedValue({ ok: false, error });
      state.doctors = [doctor()];

      await GET(cronRequest());

      expect(suspensionUpdates()).toHaveLength(0);
      expect(verifiedAtUpdates()).toHaveLength(0);
      expect(auditInserts()).toHaveLength(0);
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining("left unchanged"),
        expect.objectContaining({
          doctor_id: DOCTOR,
          cqc_provider_id: PROVIDER,
          error_kind: errorKind,
        })
      );
    }
  );

  it("does not suspend when the parsed registration status is unreadable", async () => {
    vi.mocked(fetchCqcProvider).mockResolvedValue({
      ok: true,
      data: {
        providerId: PROVIDER,
        name: "",
        registrationStatus: "Unknown",
        registrationDate: null,
        deregistrationDate: null,
        type: null,
        brandId: null,
        locationIds: [],
        raw: {},
      },
    });
    state.doctors = [doctor()];

    await GET(cronRequest());

    expect(suspensionUpdates()).toHaveLength(0);
    expect(verifiedAtUpdates()).toHaveLength(0);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining("left unchanged"),
      expect.objectContaining({
        doctor_id: DOCTOR,
        registration_status: "Unknown",
      })
    );
  });

  it("skips the Softsmoke test doctor only when the credentials switch is 1", async () => {
    process.env.SOFT_LAUNCH_SOFTSMOKE_CREDENTIALS_SKIP = "1";
    vi.mocked(fetchCqcProvider).mockResolvedValue({
      ok: false,
      error: { kind: "not_found", status: 404 },
    });
    state.doctors = [
      doctor({
        id: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id,
        cqc_provider_id: DUMMY_PROVIDER,
        indemnity_expiry: "2020-01-01",
      }),
    ];

    await GET(cronRequest());

    expect(fetchCqcProvider).not.toHaveBeenCalled();
    expect(suspensionUpdates()).toHaveLength(0);
    expect(auditInserts()).toHaveLength(0);
    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining("Skipping CQC re-check"),
      expect.objectContaining({
        doctor_id: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id,
        reason: expect.stringContaining("SOFT_LAUNCH_SOFTSMOKE_CREDENTIALS_SKIP=1"),
      })
    );
  });

  it("does not skip the Softsmoke test doctor when the switch is unset", async () => {
    delete process.env.SOFT_LAUNCH_SOFTSMOKE_CREDENTIALS_SKIP;
    vi.mocked(fetchCqcProvider).mockResolvedValue({
      ok: false,
      error: { kind: "not_found", status: 404 },
    });
    state.doctors = [
      doctor({
        id: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id,
        cqc_provider_id: DUMMY_PROVIDER,
      }),
    ];

    await GET(cronRequest());

    expect(fetchCqcProvider).toHaveBeenCalledWith(DUMMY_PROVIDER);
    expect(suspensionUpdates()).toHaveLength(1);
    expect(auditInserts()[0]?.payload).toMatchObject({
      target_id: SOFT_LAUNCH_SOFTSMOKE_DOCTOR.id,
      action: "doctor_auto_suspended",
    });
    expect(log.info).not.toHaveBeenCalledWith(
      expect.stringContaining("Skipping CQC re-check"),
      expect.anything()
    );
  });

  it("does not skip a different doctor id when the switch is 1", async () => {
    process.env.SOFT_LAUNCH_SOFTSMOKE_CREDENTIALS_SKIP = "1";
    vi.mocked(fetchCqcProvider).mockResolvedValue({
      ok: false,
      error: { kind: "not_found", status: 404 },
    });
    state.doctors = [doctor({ id: DOCTOR, cqc_provider_id: DUMMY_PROVIDER })];

    await GET(cronRequest());

    expect(fetchCqcProvider).toHaveBeenCalledWith(DUMMY_PROVIDER);
    expect(suspensionUpdates()).toHaveLength(1);
  });

  it("writes an audit row when indemnity expiry suspends the doctor", async () => {
    state.doctors = [
      doctor({
        cqc_status: null,
        cqc_provider_id: null,
        indemnity_expiry: "2020-01-01",
      }),
    ];

    await GET(cronRequest());

    expect(fetchCqcProvider).not.toHaveBeenCalled();
    expect(suspensionUpdates()).toHaveLength(1);
    const audit = auditInserts()[0]?.payload;
    expect(audit).toMatchObject({
      actor_id: ACTOR,
      action: "doctor_auto_suspended",
      target_type: "doctor",
      target_id: DOCTOR,
    });
    expect(audit?.metadata).toMatchObject({
      cqc_provider_id: null,
      register_response: {
        http_status: null,
        registration_status: null,
        error_kind: null,
      },
      actor_kind: "system",
      actor_resolution: "AUDIT_SYSTEM_ACTOR_ID",
    });
    expect((audit?.metadata as { reason: string }).reason).toContain("expired");
  });

  it("attributes the audit row to the oldest admin when no system actor env is set", async () => {
    delete process.env[AUDIT_SYSTEM_ACTOR_ENV];
    state.adminProfile = { id: ADMIN };
    vi.mocked(fetchCqcProvider).mockResolvedValue({
      ok: true,
      data: {
        providerId: PROVIDER,
        name: "Example",
        registrationStatus: "Deregistered",
        registrationDate: null,
        deregistrationDate: null,
        type: null,
        brandId: null,
        locationIds: [],
        raw: {},
      },
    });
    state.doctors = [doctor()];

    await GET(cronRequest());

    expect(auditInserts()[0]?.payload).toMatchObject({
      actor_id: ADMIN,
      metadata: expect.objectContaining({
        actor_kind: "system",
        actor_resolution: "admin_profile_fallback",
      }),
    });
  });
});
