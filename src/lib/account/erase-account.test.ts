import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  ACTIVE_BOOKINGS_ERROR,
  ERASE_FAILED_ERROR,
  eraseAccount,
  erasedAuthAdminAttributes,
  type EraseAdmin,
  type EraseFilter,
} from "./erase-account";

const USER_ID = "11111111-1111-4111-8111-111111111111";

type Row = Record<string, unknown>;

function createAdmin(options: {
  tables?: Record<string, Row[]>;
  rpc?: { data: unknown; error: { message: string; code?: string } | null };
  rpcSequence?: { data: unknown; error: { message: string; code?: string } | null }[];
  deleteError?: { message: string; code?: string } | null;
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

    const run = () => {
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
      return { data: matched.map((row) => ({ ...row })), error: null };
    };

    const api = {
      select() {
        action = "select";
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
        return Promise.resolve({ data: result.data[0] ?? null, error: null });
      },
      then(
        resolve: (value: { data: Row[]; error: null }) => unknown,
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
  } as unknown as EraseAdmin;

  return { admin, deleteUser, updateUserById, rpc, updates, deletes, tables };
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

  it("anonymises a patient with an audited prescription and does not deleteUser", async () => {
    const { admin, deleteUser, updateUserById } = createAdmin({
      rpc: {
        data: {
          mode: "anonymised",
          erased_at: "2026-09-30T12:00:00.000Z",
          email: `erased+${USER_ID}@users.invalid`,
        },
        error: null,
      },
    });

    const result = await eraseAccount(USER_ID, admin);

    expect(result).toEqual({ success: true, mode: "anonymised" });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(updateUserById).toHaveBeenCalledWith(USER_ID, erasedAuthAdminAttributes(USER_ID));
    expect(erasedAuthAdminAttributes(USER_ID).email).toBe(
      `erased+${USER_ID}@users.invalid`
    );
    expect(erasedAuthAdminAttributes(USER_ID).ban_duration).toBe("876000h");
  });

  it("anonymises a doctor who authored audit rows when deleteUser hits 23503", async () => {
    const { admin, deleteUser, updateUserById } = createAdmin({
      rpcSequence: [
        { data: { mode: "hard_delete" }, error: null },
        {
          data: { mode: "anonymised", email: `erased+${USER_ID}@users.invalid` },
          error: null,
        },
      ],
      deleteError: { message: "update or delete on table profiles violates foreign key", code: "23503" },
    });

    const result = await eraseAccount(USER_ID, admin);

    expect(result).toEqual({ success: true, mode: "anonymised" });
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
