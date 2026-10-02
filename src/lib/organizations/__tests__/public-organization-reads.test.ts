import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";

type Row = Record<string, unknown>;
type Filter = { op: "eq" | "gt"; column: string; value: unknown };
type Read = { table: string; select: string; filters: Filter[] };

const gate = vi.hoisted(() => ({
  userId: null as string | null,
  adminCalls: 0,
  userFromCalls: 0,
  leakMembership: false,
  reads: [] as Read[],
  tables: {} as Record<string, Row[]>,
}));

function project(row: Row, select: string): Row {
  const projected: Row = {};
  for (const column of select.split(",").map((part) => part.trim())) {
    projected[column] = row[column];
  }
  return projected;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: gate.userId ? { id: gate.userId } : null },
      }),
    },
    from() {
      gate.userFromCalls += 1;
      throw new Error("session client must not read organizations");
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    gate.adminCalls += 1;
    return {
      from(table: string) {
        const filters: Filter[] = [];
        let select = "";
        const api = {
          select(value: string) {
            select = value;
            return api;
          },
          eq(column: string, value: unknown) {
            filters.push({ op: "eq", column, value });
            return api;
          },
          gt(column: string, value: unknown) {
            filters.push({ op: "gt", column, value });
            return api;
          },
          in() {
            return api;
          },
          limit() {
            return api;
          },
          order() {
            return api;
          },
          maybeSingle() {
            return Promise.resolve(finish(false));
          },
          single() {
            return Promise.resolve(finish(true));
          },
        };

        function finish(requireOne: boolean) {
          gate.reads.push({
            table,
            select,
            filters: filters.map((filter) => ({ ...filter })),
          });
          const applied = filters.filter(
            (filter) =>
              !(
                gate.leakMembership &&
                table === "organization_members" &&
                filter.column === "user_id"
              )
          );
          const rows = (gate.tables[table] ?? []).filter((row) =>
            applied.every((filter) => {
              const value = row[filter.column];
              if (filter.op === "eq") return value === filter.value;
              return String(value) > String(filter.value);
            })
          );
          const row = rows[0] ?? null;
          const data = row && table === "organizations" ? project(row, select) : row;
          if (requireOne && !data) return { data: null, error: { message: "missing" } };
          return { data, error: null };
        }

        return api;
      },
    };
  },
}));

import { resolveInviteToken } from "@/actions/clinic-invitations";
import { getMyPendingOrganizationInvitation } from "@/actions/pending-organization-invite";
import {
  loadPublicClinicMetadata,
  loadPublicClinicPage,
} from "@/lib/organizations/load-public-clinic";
import {
  CLINIC_INVITE_ORGANIZATION_COLUMNS,
  CLINIC_METADATA_ORGANIZATION_COLUMNS,
  CLINIC_PAGE_ORGANIZATION_COLUMNS,
  INVITED_MEMBER_ORGANIZATION_COLUMNS,
  PUBLIC_ORGANIZATION_COLUMNS,
  publicOrganizationSelectList,
} from "@/lib/organizations/public-columns";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function readsFor(table: string): Read[] {
  return gate.reads.filter((entry) => entry.table === table);
}

function expectOnlyPublicColumns(select: string) {
  const columns = select.split(",").map((part) => part.trim());
  expect(columns.length).toBeGreaterThan(0);
  expect(select.includes("*")).toBe(false);
  for (const column of columns) {
    expect(PUBLIC_ORGANIZATION_COLUMNS).toContain(column);
  }
}

const TOKEN_A = "a".repeat(64);
const TOKEN_B = "b".repeat(64);
const TOKEN_MISSING = "c".repeat(64);

const secretOrgFields = {
  email: "secret@clinic.test",
  phone: "+440000000",
  stripe_customer_id: "cus_secret",
  metadata: { private: true },
};

beforeEach(() => {
  gate.userId = null;
  gate.adminCalls = 0;
  gate.userFromCalls = 0;
  gate.leakMembership = false;
  gate.reads = [];
  gate.tables = {
    clinic_invitations: [],
    organization_members: [],
    organizations: [
      {
        id: "org-a",
        name: "Harbour Clinic",
        slug: "harbour",
        logo_url: "https://example.com/harbour.png",
        cover_image_url: "https://example.com/cover.png",
        description: "A clinic",
        website: "https://harbour.example",
        specialties: ["cardiology"],
        seo_title: "Harbour",
        seo_description: "Private clinic",
        brand_display_name: "Harbour",
        brand_favicon_url: "https://example.com/favicon.png",
        ...secretOrgFields,
      },
      {
        id: "org-b",
        name: "Other Clinic",
        slug: "other",
        logo_url: null,
        ...secretOrgFields,
        email: "other@clinic.test",
      },
    ],
  };
});

describe("public organization column list", () => {
  it("rejects star selects and columns outside the 00128 view", () => {
    expect(() => publicOrganizationSelectList("*")).toThrow(/explicit column list/);
    expect(() => publicOrganizationSelectList("name, *")).toThrow(/explicit column list/);
    expect(() => publicOrganizationSelectList("name, email")).toThrow(/not public: email/);
    expect(() => publicOrganizationSelectList("phone")).toThrow(/not public: phone/);
    expect(() => publicOrganizationSelectList("stripe_customer_id")).toThrow(/not public/);
    expect(publicOrganizationSelectList("name, slug")).toBe("name, slug");
  });

  it("keeps every caller list inside the view columns", () => {
    for (const select of [
      CLINIC_METADATA_ORGANIZATION_COLUMNS,
      CLINIC_PAGE_ORGANIZATION_COLUMNS,
      CLINIC_INVITE_ORGANIZATION_COLUMNS,
      INVITED_MEMBER_ORGANIZATION_COLUMNS,
    ]) {
      expectOnlyPublicColumns(select);
    }
    expect(CLINIC_METADATA_ORGANIZATION_COLUMNS).toBe(
      "name, description, seo_title, seo_description, logo_url, slug, cover_image_url"
    );
    expect(CLINIC_PAGE_ORGANIZATION_COLUMNS).toBe(
      "id, name, slug, logo_url, cover_image_url, description, website, specialties, seo_title, seo_description, brand_display_name, brand_favicon_url"
    );
    expect(CLINIC_INVITE_ORGANIZATION_COLUMNS).toBe("id, name, slug, logo_url");
    expect(INVITED_MEMBER_ORGANIZATION_COLUMNS).toBe("name");
  });
});

describe("clinic public page", () => {
  function clientFor(slugRow: Row | null) {
    const calls: { select: string; filters: Filter[] }[] = [];
    const admin = {
      from(table: string) {
        if (table !== "organizations") throw new Error(`unexpected table ${table}`);
        const filters: Filter[] = [];
        let select = "";
        const api = {
          select(value: string) {
            select = value;
            return api;
          },
          eq(column: string, value: unknown) {
            filters.push({ op: "eq" as const, column, value });
            return api;
          },
          async single() {
            calls.push({ select, filters: [...filters] });
            if (!slugRow) return { data: null, error: { message: "missing" } };
            return { data: project(slugRow, select), error: null };
          },
        };
        return api;
      },
    };
    return { admin: admin as unknown as ReturnType<typeof createAdminClient>, calls };
  }

  const harbour = gate.tables.organizations?.[0] ?? {
    id: "org-a",
    name: "Harbour Clinic",
    slug: "harbour",
    email: "secret@clinic.test",
  };

  it("selects the metadata columns and only the requested slug", async () => {
    const { admin, calls } = clientFor({
      ...harbour,
      email: "secret@clinic.test",
      phone: "+440000000",
      stripe_customer_id: "cus_secret",
    });
    const org = await loadPublicClinicMetadata("harbour", admin);
    expect(calls).toEqual([
      {
        select: CLINIC_METADATA_ORGANIZATION_COLUMNS,
        filters: [{ op: "eq", column: "slug", value: "harbour" }],
      },
    ]);
    expectOnlyPublicColumns(calls[0].select);
    expect(org).toMatchObject({ name: "Harbour Clinic", slug: "harbour" });
    expect(org).not.toHaveProperty("email");
    expect(org).not.toHaveProperty("phone");
    expect(org).not.toHaveProperty("stripe_customer_id");
    expect(gate.adminCalls).toBe(0);
  });

  it("selects the page columns and returns null when the slug is missing", async () => {
    const found = clientFor({
      ...harbour,
      email: "secret@clinic.test",
    });
    const org = await loadPublicClinicPage("harbour", found.admin);
    expect(found.calls[0].select).toBe(CLINIC_PAGE_ORGANIZATION_COLUMNS);
    expect(found.calls[0].filters).toEqual([{ op: "eq", column: "slug", value: "harbour" }]);
    expectOnlyPublicColumns(found.calls[0].select);
    expect(org?.id).toBe("org-a");
    expect(org).not.toHaveProperty("email");

    const missing = clientFor(null);
    expect(await loadPublicClinicPage("missing", missing.admin)).toBeNull();
    expect(await loadPublicClinicMetadata("missing", missing.admin)).toBeNull();
  });

  it("does not filter on a public flag because organizations has none", () => {
    const columns = organizationColumns();
    for (const flag of [
      "status",
      "is_active",
      "is_published",
      "published",
      "verified",
      "is_verified",
      "is_public",
      "visibility",
    ]) {
      expect(columns.has(flag), flag).toBe(false);
    }
    for (const column of PUBLIC_ORGANIZATION_COLUMNS) {
      expect(columns.has(column), column).toBe(true);
    }

    const loader = read("src/lib/organizations/load-public-clinic.ts");
    expect(loader).toContain('.eq("slug", slug)');
    expect(loader).not.toMatch(
      /\.eq\(\s*["'](status|is_active|is_published|published|verified|is_verified|is_public|visibility)["']/
    );
    expect(loader).not.toContain('select("*")');
    expect(loader).not.toContain("select('*')");

    const page = read("src/app/[locale]/(public)/clinics/[slug]/page.tsx");
    expect(page).toContain("loadPublicClinicMetadata(slug)");
    expect(page).toContain("loadPublicClinicPage(slug)");
    expect(page).toContain("notFound()");
    expect(page).not.toContain("public_organizations");
    expect(read("src/app/[locale]/(public)/clinics/layout.tsx")).toContain(
      "soft-launch-dark-layout"
    );
  });
});

describe("invitation organization reads", () => {
  it("does not read an organization for an anonymous banner or a bad token", async () => {
    expect(await getMyPendingOrganizationInvitation()).toBeNull();
    expect(gate.adminCalls).toBe(0);
    expect(gate.userFromCalls).toBe(0);

    expect(await resolveInviteToken("not-a-token")).toEqual({
      error: "Invitation not found or has expired",
      invite: null,
    });
    expect(gate.adminCalls).toBe(0);
    expect(readsFor("organizations")).toEqual([]);
  });

  it("does not read an organization when the invitation is missing or belongs to someone else", async () => {
    gate.tables.clinic_invitations = [
      {
        id: "inv-b",
        email: "other@example.com",
        role: "doctor",
        token: TOKEN_B,
        expires_at: "2099-01-01T00:00:00.000Z",
        organization_id: "org-b",
        status: "pending",
      },
    ];

    const missing = await resolveInviteToken(TOKEN_MISSING);
    expect(missing.invite).toBeNull();
    expect(readsFor("organizations")).toEqual([]);
    expect(readsFor("clinic_invitations")[0].filters).toEqual([
      { op: "eq", column: "token", value: TOKEN_MISSING },
      { op: "eq", column: "status", value: "pending" },
      expect.objectContaining({ op: "gt", column: "expires_at" }),
    ]);

    gate.userId = "user-a";
    gate.tables.organization_members = [
      {
        user_id: "user-b",
        organization_id: "org-b",
        role: "doctor",
        status: "invited",
        invited_at: "2026-10-01T00:00:00.000Z",
        inviter: { first_name: "Eve", last_name: "Other" },
      },
    ];
    expect(await getMyPendingOrganizationInvitation()).toBeNull();
    expect(readsFor("organizations")).toEqual([]);
    expect(readsFor("organization_members")[0].filters).toContainEqual({
      op: "eq",
      column: "user_id",
      value: "user-a",
    });

    gate.leakMembership = true;
    gate.reads = [];
    expect(await getMyPendingOrganizationInvitation()).toBeNull();
    expect(readsFor("organizations")).toEqual([]);
  });

  it("reads only the caller's invited organization name", async () => {
    gate.userId = "user-a";
    gate.tables.organization_members = [
      {
        user_id: "user-a",
        organization_id: "org-a",
        role: "doctor",
        status: "invited",
        invited_at: "2026-10-01T00:00:00.000Z",
        inviter: { first_name: "Ada", last_name: "Lovelace" },
      },
    ];

    const pending = await getMyPendingOrganizationInvitation();
    expect(pending).toEqual({
      organizationId: "org-a",
      organizationName: "Harbour Clinic",
      role: "doctor",
      inviterName: "Ada Lovelace",
      invitedAt: "2026-10-01T00:00:00.000Z",
    });
    expect(readsFor("organizations")).toEqual([
      {
        table: "organizations",
        select: INVITED_MEMBER_ORGANIZATION_COLUMNS,
        filters: [{ op: "eq", column: "id", value: "org-a" }],
      },
    ]);
    expectOnlyPublicColumns(readsFor("organizations")[0].select);
    expect(gate.userFromCalls).toBe(0);

    const action = read("src/actions/pending-organization-invite.ts");
    const body = action.slice(action.indexOf("export async function getMyPendingOrganizationInvitation"));
    expect(body.indexOf("getUser()")).toBeLessThan(body.indexOf("createAdminClient()"));
    expect(body.indexOf('.eq("status", "invited")')).toBeLessThan(
      body.indexOf('.from("organizations")')
    );
    expect(body).toContain("membership.user_id !== user.id");
    expect(read("src/components/shared/invitation-banner.tsx")).not.toContain("createAdminClient");
  });

  it("reads only the organization on the presented invitation", async () => {
    gate.tables.clinic_invitations = [
      {
        id: "inv-a",
        email: "ada@example.com",
        role: "doctor",
        token: TOKEN_A,
        expires_at: "2099-01-01T00:00:00.000Z",
        organization_id: "org-a",
        status: "pending",
      },
      {
        id: "inv-b",
        email: "other@example.com",
        role: "admin",
        token: TOKEN_B,
        expires_at: "2099-01-01T00:00:00.000Z",
        organization_id: "org-b",
        status: "pending",
      },
    ];

    const resolved = await resolveInviteToken(TOKEN_A);
    expect(resolved.error).toBeNull();
    expect(resolved.invite?.organization).toEqual({
      id: "org-a",
      name: "Harbour Clinic",
      slug: "harbour",
      logo_url: "https://example.com/harbour.png",
    });
    expect(resolved.invite?.organization).not.toHaveProperty("email");
    expect(resolved.invite?.organization).not.toHaveProperty("phone");
    expect(resolved.invite?.organization).not.toHaveProperty("stripe_customer_id");
    expect(readsFor("organizations")).toEqual([
      {
        table: "organizations",
        select: CLINIC_INVITE_ORGANIZATION_COLUMNS,
        filters: [{ op: "eq", column: "id", value: "org-a" }],
      },
    ]);
    expectOnlyPublicColumns(readsFor("organizations")[0].select);

    gate.reads = [];
    const other = await resolveInviteToken(TOKEN_B);
    expect(other.invite?.organization).toMatchObject({ id: "org-b", name: "Other Clinic" });
    expect(readsFor("organizations")[0].filters).toEqual([
      { op: "eq", column: "id", value: "org-b" },
    ]);
    expect(other.invite?.organization_id).toBe("org-b");
    expect(other.invite?.organization).not.toHaveProperty("email");
  });
});

function organizationColumns(): Set<string> {
  const columns = new Set<string>();
  const create = read("supabase/migrations/00047_create_organizations_and_licenses.sql");
  const start = create.indexOf("CREATE TABLE public.organizations (");
  const end = create.indexOf("CREATE UNIQUE INDEX idx_organizations_slug");
  const body = create.slice(start, end);
  for (const match of body.matchAll(/^\s*([a-z_][a-z0-9_]*)\s+/gm)) {
    columns.add(match[1]);
  }

  for (const file of readdirSync(join(process.cwd(), "supabase/migrations"))) {
    if (!file.endsWith(".sql")) continue;
    const sql = read(join("supabase/migrations", file));
    const parts = sql.split(/ALTER TABLE public\.organizations\b/);
    for (const part of parts.slice(1)) {
      const statement = part.split(";")[0] ?? "";
      for (const match of statement.matchAll(/ADD COLUMN(?: IF NOT EXISTS)?\s+([a-z_][a-z0-9_]*)/gi)) {
        columns.add(match[1].toLowerCase());
      }
    }
  }
  return columns;
}
