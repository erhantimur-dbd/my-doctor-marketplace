import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  ACTIVE_BOOKINGS_ERROR,
  ERASE_FAILED_ERROR,
  ERASURE_BLOCKED_ERROR,
  eraseAccount,
  erasedAuthAdminAttributes,
  findErasureBlock,
  hasSharedMedicalProfile,
  releaseOrgOwnership,
  type EraseAdmin,
  type EraseFilter,
} from "./erase-account";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const DOCTOR_ID = "22222222-2222-4222-8222-222222222222";
const ORG_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_ID = "44444444-4444-4444-8444-444444444444";
const CONV_ID = "55555555-5555-4555-8555-555555555555";

type Row = Record<string, unknown>;

function createAdmin(options: {
  tables?: Record<string, Row[]>;
  rpc?: { data: unknown; error: { message: string; code?: string } | null };
  rpcSequence?: { data: unknown; error: { message: string; code?: string } | null }[];
  deleteError?: { message: string; code?: string } | null;
  missingColumns?: Record<string, string[]>;
  errorTables?: Record<string, { code: string; message: string }>;
  storage?: Record<string, { name: string; id: string | null }[]>;
}) {
  const tables: Record<string, Row[]> = {
    bookings: [],
    doctors: [],
    prescriptions: [],
    prescription_audit_log: [],
    reviews: [],
    push_subscriptions: [],
    cookie_consents: [],
    ...(options.tables ?? {}),
  };
  const updates: { table: string; values: Row; filters: Record<string, unknown> }[] = [];
  const deletes: { table: string; filters: Record<string, unknown> }[] = [];

  function from(table: string) {
    const filters: Record<string, unknown> = {};
    let action: "select" | "update" | "delete" = "select";
    let values: Row = {};
    let selectedColumns: string[] = [];

    const run = (): { data: Row[] | null; error: { code: string; message: string } | null } => {
      const tableError = options.errorTables?.[table];
      if (tableError) return { data: null, error: tableError };
      const missing = (options.missingColumns?.[table] ?? []).filter((column) =>
        action === "select" ? selectedColumns.includes(column) : column in values
      );
      if (missing.length > 0) {
        return {
          data: null,
          error: {
            code: "42703",
            message: `column ${table}.${missing[0]} does not exist`,
          },
        };
      }
      const source = tables[table] ?? [];
      const matched = source.filter((row) =>
        Object.entries(filters).every(([column, expected]) => {
          if (Array.isArray(expected)) return expected.includes(row[column]);
          return row[column] === expected;
        })
      );
      if (action === "update") {
        for (const row of matched) Object.assign(row, values);
        updates.push({ table, values, filters: { ...filters } });
      }
      if (action === "delete") {
        tables[table] = source.filter((row) => !matched.includes(row));
        deletes.push({ table, filters: { ...filters } });
      }
      const data = matched.map((row) => {
        if (action !== "select" || selectedColumns.length === 0) return { ...row };
        const projected: Row = {};
        for (const column of selectedColumns) {
          if (Object.prototype.hasOwnProperty.call(row, column)) {
            projected[column] = row[column];
          }
        }
        return projected;
      });
      return { data, error: null };
    };

    const api = {
      select(columns?: string) {
        action = "select";
        selectedColumns = (columns ?? "")
          .split(",")
          .map((column) => column.trim())
          .filter(Boolean);
        return api;
      },
      update(next: Row) {
        action = "update";
        values = next;
        return api;
      },
      delete() {
        action = "delete";
        return api;
      },
      eq(column: string, value: string) {
        filters[column] = value;
        return api;
      },
      in(column: string, value: readonly string[]) {
        filters[column] = [...value];
        return api;
      },
      limit() {
        return Promise.resolve(run());
      },
      maybeSingle() {
        const result = run();
        return Promise.resolve({ data: result.data?.[0] ?? null, error: result.error });
      },
      then(
        resolve: (value: { data: Row[] | null; error: { code: string; message: string } | null }) => unknown,
        reject?: (reason: unknown) => unknown
      ) {
        return Promise.resolve(run()).then(resolve, reject);
      },
    };
    return api as unknown as EraseFilter & {
      select: () => typeof api;
      update: (values: Row) => typeof api;
      delete: () => typeof api;
    };
  }

  const removed: { bucket: string; paths: string[] }[] = [];
  const storage = {
    from(bucket: string) {
      return {
        async list(prefix: string) {
          return { data: options.storage?.[`${bucket}:${prefix}`] ?? [], error: null };
        },
        async remove(paths: string[]) {
          removed.push({ bucket, paths: [...paths] });
          return { error: null };
        },
      };
    },
  };
  const deleteUser = vi.fn(async () => ({ error: options.deleteError ?? null }));
  const updateUserById = vi.fn(async () => ({ error: null }));
  const sequence = [...(options.rpcSequence ?? [])];
  const rpc = vi.fn(async () => {
    if (sequence.length > 0) return sequence.shift()!;
    return options.rpc ?? { data: { mode: "hard_delete" }, error: null };
  });

  const admin = {
    from,
    rpc,
    auth: { admin: { deleteUser, updateUserById } },
    storage,
  } as unknown as EraseAdmin;

  return { admin, deleteUser, updateUserById, rpc, updates, deletes, tables, removed };
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")) out.push(path);
  }
  return out;
}

describe("eraseAccount routing", () => {
  it("hard-deletes when erase_account reports no retained rows", async () => {
    const { admin, deleteUser, updateUserById, rpc } = createAdmin({
      rpc: { data: { mode: "hard_delete" }, error: null },
    });

    const result = await eraseAccount(USER_ID, admin);

    expect(result).toEqual({ success: true, mode: "hard_deleted" });
    expect(rpc).toHaveBeenCalledWith("erase_account", { p_user_id: USER_ID });
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it("restricts a patient with an audited prescription and does not deleteUser", async () => {
    const { admin, deleteUser, updateUserById } = createAdmin({
      rpc: {
        data: {
          mode: "restricted",
          restricted_at: "2026-09-30T12:00:00.000Z",
          email: `erased+${USER_ID}@users.invalid`,
        },
        error: null,
      },
    });

    const result = await eraseAccount(USER_ID, admin);

    expect(result).toEqual({ success: true, mode: "restricted" });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(updateUserById).toHaveBeenCalledWith(USER_ID, erasedAuthAdminAttributes(USER_ID));
    expect(erasedAuthAdminAttributes(USER_ID).email).toBe(
      `erased+${USER_ID}@users.invalid`
    );
    expect(erasedAuthAdminAttributes(USER_ID).ban_duration).toBe("876000h");
  });

  it("restricts a doctor who authored audit rows when deleteUser hits 23503", async () => {
    const { admin, deleteUser, updateUserById } = createAdmin({
      rpcSequence: [
        { data: { mode: "hard_delete" }, error: null },
        {
          data: { mode: "restricted", email: `erased+${USER_ID}@users.invalid` },
          error: null,
        },
      ],
      deleteError: { message: "update or delete on table profiles violates foreign key", code: "23503" },
    });

    const result = await eraseAccount(USER_ID, admin);

    expect(result).toEqual({ success: true, mode: "restricted" });
    expect(deleteUser).toHaveBeenCalledTimes(1);
    expect(updateUserById).toHaveBeenCalledTimes(1);
  });

  it("does not deleteUser when retained rows exist and the SQL helper is not installed yet", async () => {
    const { admin, deleteUser } = createAdmin({
      tables: {
        prescriptions: [{ id: "rx-1", patient_id: USER_ID }],
      },
      rpc: {
        data: null,
        error: { code: "PGRST202", message: "Could not find the function public.erase_account" },
      },
    });

    const result = await eraseAccount(USER_ID, admin);

    expect(result).toEqual({ error: ERASE_FAILED_ERROR });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("does not deleteUser when the user has a review and the helper is missing", async () => {
    const { admin, deleteUser, updates } = createAdmin({
      tables: {
        reviews: [{ id: "rev-1", patient_id: USER_ID, comment: "keep-this-review" }],
      },
      rpc: {
        data: null,
        error: { code: "PGRST202", message: "Could not find the function public.erase_account" },
      },
    });

    const result = await eraseAccount(USER_ID, admin);

    expect(result).toEqual({ error: ERASE_FAILED_ERROR });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(updates.some((update) => update.table === "reviews")).toBe(false);
  });

  it("hard-deletes an unshared medical profile when the helper is missing", async () => {
    const { admin, deleteUser } = createAdmin({
      tables: {
        medical_profiles: [{ id: "med-1", patient_id: USER_ID, blood_type: "O+", sharing_consent: false }],
      },
      rpc: {
        data: null,
        error: { code: "PGRST202", message: "Could not find the function public.erase_account" },
      },
    });

    const result = await eraseAccount(USER_ID, admin);

    expect(result).toEqual({ success: true, mode: "hard_deleted" });
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it("does not deleteUser when a medical profile was shared and the helper is missing", async () => {
    const { admin, deleteUser } = createAdmin({
      tables: {
        medical_profiles: [{ id: "med-1", patient_id: USER_ID, blood_type: "O+", sharing_consent: true }],
        bookings: [{ id: "bk-shared", patient_id: USER_ID, status: "completed" }],
      },
      rpc: {
        data: null,
        error: { code: "PGRST202", message: "Could not find the function public.erase_account" },
      },
    });

    const result = await eraseAccount(USER_ID, admin);

    expect(result).toEqual({ error: ERASE_FAILED_ERROR });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("counts sharing_consent true with a completed booking as shared", async () => {
    const { admin } = createAdmin({
      tables: {
        medical_profiles: [{ id: "med-1", patient_id: USER_ID, sharing_consent: true }],
        bookings: [{ id: "bk-shared", patient_id: USER_ID, status: "completed" }],
      },
    });

    await expect(hasSharedMedicalProfile(admin, USER_ID)).resolves.toBe(true);
  });

  it("does not count sharing_consent false as shared", async () => {
    const { admin } = createAdmin({
      tables: {
        medical_profiles: [{ id: "med-1", patient_id: USER_ID, sharing_consent: false }],
        bookings: [{ id: "bk-done", patient_id: USER_ID, status: "completed" }],
      },
    });

    await expect(hasSharedMedicalProfile(admin, USER_ID)).resolves.toBe(false);
  });

  it("does not count sharing_consent true without a completed booking as shared", async () => {
    const { admin } = createAdmin({
      tables: {
        medical_profiles: [{ id: "med-1", patient_id: USER_ID, sharing_consent: true }],
        bookings: [{ id: "bk-open", patient_id: USER_ID, status: "cancelled_patient" }],
      },
    });

    await expect(hasSharedMedicalProfile(admin, USER_ID)).resolves.toBe(false);
  });

  it("counts any booking as shared when sharing_consent is absent", async () => {
    const { admin } = createAdmin({
      missingColumns: { medical_profiles: ["sharing_consent"] },
      tables: {
        medical_profiles: [{ id: "med-1", patient_id: USER_ID }],
        bookings: [{ id: "bk-any", patient_id: USER_ID, status: "cancelled_patient" }],
      },
    });

    await expect(hasSharedMedicalProfile(admin, USER_ID)).resolves.toBe(true);
  });

  it("does not count a medical profile alone when sharing_consent is absent", async () => {
    const { admin } = createAdmin({
      missingColumns: { medical_profiles: ["sharing_consent"] },
      tables: {
        medical_profiles: [{ id: "med-1", patient_id: USER_ID }],
      },
    });

    await expect(hasSharedMedicalProfile(admin, USER_ID)).resolves.toBe(false);
  });

  it("still hard-deletes when the SQL helper is missing and nothing is retained", async () => {
    const { admin, deleteUser } = createAdmin({
      rpc: {
        data: null,
        error: { code: "PGRST202", message: "Could not find the function public.erase_account" },
      },
    });

    const result = await eraseAccount(USER_ID, admin);

    expect(result).toEqual({ success: true, mode: "hard_deleted" });
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it("blocks erasure while a booking is still active", async () => {
    const { admin, deleteUser, rpc } = createAdmin({
      tables: {
        bookings: [{ id: "bk-1", patient_id: USER_ID, status: "confirmed" }],
      },
    });

    const result = await eraseAccount(USER_ID, admin);

    expect(result).toEqual({ error: ACTIVE_BOOKINGS_ERROR });
    expect(rpc).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });
});

describe("restricted path when financial or clinic rows exist", () => {
  const cases: { name: string; tables: Record<string, Row[]> }[] = [
    {
      name: "a cancelled doctor subscription",
      tables: {
        doctors: [{ id: DOCTOR_ID, profile_id: USER_ID }],
        doctor_subscriptions: [{ id: "sub-1", doctor_id: DOCTOR_ID, status: "cancelled" }],
      },
    },
    {
      name: "an invoice",
      tables: { invoices: [{ id: "inv-1", patient_id: USER_ID }] },
    },
    {
      name: "a platform fee",
      tables: {
        doctors: [{ id: DOCTOR_ID, profile_id: USER_ID }],
        platform_fees: [{ id: "fee-1", doctor_id: DOCTOR_ID }],
      },
    },
    {
      name: "a treatment plan",
      tables: { treatment_plans: [{ id: "tp-1", patient_id: USER_ID }] },
    },
    {
      name: "a conversation",
      tables: { conversations: [{ id: CONV_ID, patient_id: USER_ID }] },
    },
    {
      name: "a direct message",
      tables: { direct_messages: [{ id: "msg-1", sender_id: USER_ID }] },
    },
    {
      name: "an organisation membership",
      tables: {
        organization_members: [
          { id: "mem-1", organization_id: ORG_ID, user_id: USER_ID, role: "staff", status: "active" },
        ],
      },
    },
    {
      name: "a patient wallet",
      tables: { patient_wallet: [{ id: "wal-1", patient_id: USER_ID }] },
    },
  ];

  for (const testCase of cases) {
    it(`restricts instead of deleteUser when the user has ${testCase.name}`, async () => {
      const { admin, deleteUser, updateUserById } = createAdmin({
        tables: testCase.tables,
        rpc: { data: { mode: "hard_delete" }, error: null },
      });

      const result = await eraseAccount(USER_ID, admin);

      expect(result).toEqual({ success: true, mode: "restricted" });
      expect(deleteUser).not.toHaveBeenCalled();
      expect(updateUserById).toHaveBeenCalledWith(USER_ID, erasedAuthAdminAttributes(USER_ID));
    });
  }

  it("does not deleteUser when an invoice exists and the SQL helper is missing", async () => {
    const { admin, deleteUser } = createAdmin({
      tables: { invoices: [{ id: "inv-1", patient_id: USER_ID }] },
      rpc: {
        data: null,
        error: { code: "PGRST202", message: "Could not find the function public.erase_account" },
      },
    });

    const result = await eraseAccount(USER_ID, admin);

    expect(result).toEqual({ error: ERASE_FAILED_ERROR });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("still hard-deletes when a payments table is absent", async () => {
    const { admin, deleteUser } = createAdmin({
      errorTables: {
        payments: { code: "42P01", message: 'relation "public.payments" does not exist' },
      },
      rpc: { data: { mode: "hard_delete" }, error: null },
    });

    const result = await eraseAccount(USER_ID, admin);

    expect(result).toEqual({ success: true, mode: "hard_deleted" });
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
  });
});

describe("erasure blocks", () => {
  it("blocks an active stored Stripe subscription and changes nothing", async () => {
    const { admin, deleteUser, rpc, updates, removed } = createAdmin({
      tables: {
        doctors: [{ id: DOCTOR_ID, profile_id: USER_ID }],
        doctor_subscriptions: [{ id: "sub-1", doctor_id: DOCTOR_ID, status: "active" }],
      },
    });

    await expect(findErasureBlock(admin, USER_ID)).resolves.toBe("stripe_subscription");
    const result = await eraseAccount(USER_ID, admin);

    expect(result).toEqual({ error: ERASURE_BLOCKED_ERROR });
    expect(rpc).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
    expect(removed).toEqual([]);
  });

  it("blocks a trialing stored Stripe subscription", async () => {
    const { admin, rpc } = createAdmin({
      tables: {
        doctors: [{ id: DOCTOR_ID, profile_id: USER_ID }],
        doctor_subscriptions: [{ id: "sub-1", doctor_id: DOCTOR_ID, status: "trialing" }],
      },
    });

    await expect(findErasureBlock(admin, USER_ID)).resolves.toBe("stripe_subscription");
    await expect(eraseAccount(USER_ID, admin)).resolves.toEqual({ error: ERASURE_BLOCKED_ERROR });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("blocks a trialing licence as a stored subscription", async () => {
    const { admin, rpc } = createAdmin({
      tables: {
        organization_members: [
          { id: "mem-1", organization_id: ORG_ID, user_id: USER_ID, role: "doctor", status: "active" },
        ],
        licenses: [{ id: "lic-1", organization_id: ORG_ID, status: "trialing" }],
      },
    });

    await expect(findErasureBlock(admin, USER_ID)).resolves.toBe("stripe_subscription");
    await expect(eraseAccount(USER_ID, admin)).resolves.toEqual({ error: ERASURE_BLOCKED_ERROR });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("blocks an active licence", async () => {
    const { admin, deleteUser, rpc, updates } = createAdmin({
      tables: {
        organization_members: [
          { id: "mem-1", organization_id: ORG_ID, user_id: USER_ID, role: "doctor", status: "active" },
        ],
        licenses: [{ id: "lic-1", organization_id: ORG_ID, status: "active" }],
      },
    });

    await expect(findErasureBlock(admin, USER_ID)).resolves.toBe("active_licence");
    await expect(eraseAccount(USER_ID, admin)).resolves.toEqual({ error: ERASURE_BLOCKED_ERROR });
    expect(rpc).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it("blocks an owner whose organisation still has another member", async () => {
    const { admin, rpc, updates } = createAdmin({
      tables: {
        organization_members: [
          { id: "mem-1", organization_id: ORG_ID, user_id: USER_ID, role: "owner", status: "active" },
          { id: "mem-2", organization_id: ORG_ID, user_id: OTHER_ID, role: "doctor", status: "invited" },
        ],
      },
    });

    await expect(findErasureBlock(admin, USER_ID)).resolves.toBe("org_owner");
    await expect(eraseAccount(USER_ID, admin)).resolves.toEqual({ error: ERASURE_BLOCKED_ERROR });
    expect(rpc).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it("maps a SQL erasure_blocked error to the cancel-or-support message", async () => {
    const { admin, deleteUser } = createAdmin({
      rpc: {
        data: null,
        error: { code: "P0001", message: "erasure_blocked" },
      },
    });

    await expect(eraseAccount(USER_ID, admin)).resolves.toEqual({ error: ERASURE_BLOCKED_ERROR });
    expect(deleteUser).not.toHaveBeenCalled();
  });
});

describe("restricted organisation owner", () => {
  it("suspends a sole owner and scrubs the organisation", async () => {
    const { admin, deleteUser, updates } = createAdmin({
      tables: {
        organization_members: [
          { id: "mem-1", organization_id: ORG_ID, user_id: USER_ID, role: "owner", status: "active" },
        ],
        organizations: [
          {
            id: ORG_ID,
            name: "Secret Clinic",
            email: "clinic@example.com",
            slug: "secret-clinic",
          },
        ],
      },
      rpc: { data: { mode: "restricted" }, error: null },
    });

    const result = await eraseAccount(USER_ID, admin);

    expect(result).toEqual({ success: true, mode: "restricted" });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(updates).toContainEqual({
      table: "organizations",
      values: {
        name: "",
        email: null,
        phone: null,
        slug: `erased-${ORG_ID}`,
        brand_display_name: "",
        brand_support_email: null,
        brand_support_phone: null,
      },
      filters: { id: ORG_ID },
    });
    expect(updates).toContainEqual({
      table: "organization_members",
      values: { status: "suspended" },
      filters: {
        organization_id: ORG_ID,
        user_id: USER_ID,
        role: "owner",
        status: "active",
      },
    });
  });

  it("retries the organisation scrub without brand columns when they are absent", async () => {
    const { admin, updates } = createAdmin({
      missingColumns: { organizations: ["brand_support_email"] },
      tables: {
        organization_members: [
          { id: "mem-1", organization_id: ORG_ID, user_id: USER_ID, role: "owner", status: "active" },
        ],
      },
      rpc: { data: { mode: "restricted" }, error: null },
    });

    await eraseAccount(USER_ID, admin);

    const orgUpdates = updates.filter((update) => update.table === "organizations");
    expect(orgUpdates).toEqual([
      {
        table: "organizations",
        values: {
          name: "",
          email: null,
          phone: null,
          slug: `erased-${ORG_ID}`,
        },
        filters: { id: ORG_ID },
      },
    ]);
  });

  it("does not scrub an organisation that still has another member", async () => {
    const { admin, updates } = createAdmin({
      tables: {
        organization_members: [
          { id: "mem-1", organization_id: ORG_ID, user_id: USER_ID, role: "owner", status: "active" },
          { id: "mem-2", organization_id: ORG_ID, user_id: OTHER_ID, role: "doctor", status: "active" },
        ],
      },
    });

    await releaseOrgOwnership(admin, USER_ID);

    expect(updates.some((update) => update.table === "organizations")).toBe(false);
    expect(updates.some((update) => update.table === "organization_members")).toBe(false);
  });
});

describe("account storage deletion", () => {
  const storage = {
    [`avatars:${USER_ID}`]: [{ name: "avatar.jpg", id: "file-1" }],
    [`public-read:${USER_ID}`]: [
      { name: "doctor-photos", id: null },
      { name: "doctor-videos", id: null },
    ],
    [`public-read:${USER_ID}/doctor-photos`]: [{ name: "a.jpg", id: "file-2" }],
    [`public-read:${USER_ID}/doctor-videos`]: [{ name: "v.mp4", id: "file-3" }],
    [`message-attachments:${CONV_ID}`]: [{ name: "1_note.pdf", id: "file-4" }],
  };

  it("deletes avatar, public media, and conversation attachments on the restricted path", async () => {
    const { admin, removed, deleteUser } = createAdmin({
      tables: { conversations: [{ id: CONV_ID, patient_id: USER_ID }] },
      storage,
      rpc: { data: { mode: "restricted" }, error: null },
    });

    const result = await eraseAccount(USER_ID, admin);

    expect(result).toEqual({ success: true, mode: "restricted" });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(removed).toEqual([
      { bucket: "avatars", paths: [`${USER_ID}/avatar.jpg`] },
      {
        bucket: "public-read",
        paths: [`${USER_ID}/doctor-photos/a.jpg`, `${USER_ID}/doctor-videos/v.mp4`],
      },
      { bucket: "message-attachments", paths: [`${CONV_ID}/1_note.pdf`] },
    ]);
  });

  it("deletes the same objects before a hard delete", async () => {
    const { admin, removed, deleteUser } = createAdmin({
      storage: {
        [`avatars:${USER_ID}`]: [{ name: "avatar.png", id: "file-1" }],
      },
      rpc: { data: { mode: "hard_delete" }, error: null },
    });

    const result = await eraseAccount(USER_ID, admin);

    expect(result).toEqual({ success: true, mode: "hard_deleted" });
    expect(removed).toEqual([{ bucket: "avatars", paths: [`${USER_ID}/avatar.png`] }]);
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
  });
});

describe("account delete call sites", () => {
  const files = sourceFiles(join(process.cwd(), "src"));

  it("calls auth.admin.deleteUser only from eraseAccount", () => {
    const hits = files.filter((file) => readFileSync(file, "utf8").includes("deleteUser"));
    expect(hits.map((file) => file.slice(process.cwd().length + 1))).toEqual([
      "src/lib/account/erase-account.ts",
    ]);
  });

  it("does not delete profiles, doctors, or prescriptions from the app", () => {
    const pattern =
      /\.from\(\s*["'](profiles|doctors|prescriptions|prescription_audit_log)["']\s*\)[\s\S]{0,120}?\.delete\(/;
    const hits = files.filter((file) => pattern.test(readFileSync(file, "utf8")));
    expect(hits).toEqual([]);
  });

  it("routes patient and doctor settings through requestAccountDeletion", () => {
    const patient = readFileSync(
      join(process.cwd(), "src/actions/patient.ts"),
      "utf8"
    );
    const ui = readFileSync(
      join(process.cwd(), "src/components/settings/account-erasure-section.tsx"),
      "utf8"
    );
    const doctorSettings = readFileSync(
      join(
        process.cwd(),
        "src/app/[locale]/(doctor)/doctor-dashboard/settings/page.tsx"
      ),
      "utf8"
    );
    expect(patient).toContain("eraseAccount(user.id)");
    expect(patient).not.toContain("deleteUser");
    expect(ui).toContain("requestAccountDeletion");
    expect(doctorSettings).toContain("AccountErasureSection");
  });
});
