import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CARE_PLANS_DISABLED_MESSAGE } from "@/lib/launch/soft-launch";
import { patientTransitionFollowUpInvitation } from "@/actions/follow-up";

type InvitationRow = {
  id: string;
  patient_id: string;
  status: string;
};

/**
 * In-memory stand-in for public.patient_transition_follow_up_invitation.
 * The migration test below locks the same predicate in SQL.
 */
function applyPatientTransition(
  rows: InvitationRow[],
  authUid: string | null,
  invitationId: string,
  status: string
): boolean {
  if (status == null || (status !== "accepted" && status !== "cancelled")) {
    return false;
  }
  if (!authUid) return false;
  const row = rows.find(
    (candidate) =>
      candidate.id === invitationId &&
      candidate.patient_id === authUid &&
      candidate.status === "pending"
  );
  if (!row) return false;
  row.status = status;
  return true;
}

const gate = vi.hoisted(() => ({
  carePlans: true,
  userId: "patient-1" as string | null,
  rows: [] as InvitationRow[],
  rpcCalls: [] as { fn: string; args: { p_invitation_id: string; p_status: string } }[],
  adminCalls: 0,
  tableWrites: 0,
}));

vi.mock("@/lib/launch/soft-launch", async () => {
  const actual = await vi.importActual<typeof import("@/lib/launch/soft-launch")>(
    "@/lib/launch/soft-launch"
  );
  return {
    ...actual,
    isCarePlansEnabled: () => gate.carePlans,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: gate.userId ? { id: gate.userId } : null },
      }),
    },
    rpc: async (
      fn: string,
      args: { p_invitation_id: string; p_status: string }
    ) => {
      gate.rpcCalls.push({ fn, args });
      const updated = applyPatientTransition(
        gate.rows,
        gate.userId,
        args.p_invitation_id,
        args.p_status
      );
      return { data: updated, error: null };
    },
    from: () => {
      gate.tableWrites += 1;
      throw new Error("patient transition must not write follow_up_invitations directly");
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    gate.adminCalls += 1;
    throw new Error("patient transition must not use the service role");
  },
}));

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function seed(row: InvitationRow) {
  gate.rows = [{ ...row }];
}

beforeEach(() => {
  gate.carePlans = true;
  gate.userId = "patient-1";
  gate.rows = [];
  gate.rpcCalls = [];
  gate.adminCalls = 0;
  gate.tableWrites = 0;
});

describe("patient follow-up transition", () => {
  it("patient accepts own pending invitation", async () => {
    seed({ id: "inv-1", patient_id: "patient-1", status: "pending" });

    const result = await patientTransitionFollowUpInvitation("inv-1", "accepted");

    expect(result).toEqual({ success: true });
    expect(gate.rows).toEqual([
      { id: "inv-1", patient_id: "patient-1", status: "accepted" },
    ]);
  });

  it("patient cancels own pending invitation", async () => {
    seed({ id: "inv-1", patient_id: "patient-1", status: "pending" });

    const result = await patientTransitionFollowUpInvitation("inv-1", "cancelled");

    expect(result).toEqual({ success: true });
    expect(gate.rows).toEqual([
      { id: "inv-1", patient_id: "patient-1", status: "cancelled" },
    ]);
  });

  it("refuses accept or cancel of another patient's invitation and leaves the row unchanged", async () => {
    seed({ id: "inv-1", patient_id: "patient-2", status: "pending" });

    const accepted = await patientTransitionFollowUpInvitation("inv-1", "accepted");
    expect(accepted).toEqual({ error: "This invitation can no longer be updated." });
    expect(gate.rows[0].status).toBe("pending");

    const cancelled = await patientTransitionFollowUpInvitation("inv-1", "cancelled");
    expect(cancelled).toEqual({ error: "This invitation can no longer be updated." });
    expect(gate.rows).toEqual([
      { id: "inv-1", patient_id: "patient-2", status: "pending" },
    ]);
  });

  it("refuses a second accept once the invitation is already accepted", async () => {
    seed({ id: "inv-1", patient_id: "patient-1", status: "accepted" });

    const result = await patientTransitionFollowUpInvitation("inv-1", "accepted");

    expect(result).toEqual({ error: "This invitation can no longer be updated." });
    expect(gate.rows).toEqual([
      { id: "inv-1", patient_id: "patient-1", status: "accepted" },
    ]);
  });

  it("refuses an invalid status", async () => {
    seed({ id: "inv-1", patient_id: "patient-1", status: "pending" });

    const result = await patientTransitionFollowUpInvitation("inv-1", "expired");

    expect(result).toEqual({ error: "This invitation can no longer be updated." });
    expect(gate.rows).toEqual([
      { id: "inv-1", patient_id: "patient-1", status: "pending" },
    ]);
  });

  it("calls the transition RPC through the user session and not the service role", async () => {
    seed({ id: "inv-1", patient_id: "patient-1", status: "pending" });

    await patientTransitionFollowUpInvitation("inv-1", "accepted");

    expect(gate.rpcCalls).toEqual([
      {
        fn: "patient_transition_follow_up_invitation",
        args: { p_invitation_id: "inv-1", p_status: "accepted" },
      },
    ]);
    expect(gate.adminCalls).toBe(0);
    expect(gate.tableWrites).toBe(0);

    const action = read("src/actions/follow-up.ts");
    const body = action.slice(
      action.indexOf("export async function patientTransitionFollowUpInvitation"),
      action.length
    );
    expect(body).toContain("await createClient()");
    expect(body).toContain('supabase.rpc(\n      "patient_transition_follow_up_invitation"');
    expect(body).not.toContain("createAdminClient()");
  });

  it("short-circuits when care plans are disabled", async () => {
    gate.carePlans = false;
    seed({ id: "inv-1", patient_id: "patient-1", status: "pending" });

    const result = await patientTransitionFollowUpInvitation("inv-1", "accepted");

    expect(result).toEqual({ error: CARE_PLANS_DISABLED_MESSAGE });
    expect(gate.rpcCalls).toEqual([]);
    expect(gate.adminCalls).toBe(0);
    expect(gate.rows[0].status).toBe("pending");
  });
});

describe("patient_transition_follow_up_invitation SQL", () => {
  it("binds the update to auth.uid() and status pending", () => {
    const sql = read("supabase/migrations/00128_security_additive.sql");
    const fn = sql.slice(
      sql.indexOf(
        "CREATE OR REPLACE FUNCTION public.patient_transition_follow_up_invitation"
      ),
      sql.indexOf(
        "REVOKE ALL ON FUNCTION public.patient_transition_follow_up_invitation"
      )
    );
    const update = fn.slice(
      fn.indexOf("UPDATE public.follow_up_invitations"),
      fn.indexOf("RETURNING")
    );

    expect(update).toContain("patient_id = auth.uid()");
    expect(update).toContain("status = 'pending'");
    expect(fn).toContain("p_status NOT IN ('accepted', 'cancelled')");
    expect(fn).toContain("IF auth.uid() IS NULL THEN");
  });
});
