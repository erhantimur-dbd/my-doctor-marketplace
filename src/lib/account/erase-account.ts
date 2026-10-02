import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/utils/logger";

/**
 * Single account-erasure entry point.
 *
 * erase_account restricts the account when deleteUser would fail with
 * 23503, and when a prescription, a shared medical profile, a review, or
 * another non-cascading row must stay. Review text is removed and the
 * rating stays. The author name is cleared. Otherwise the historical
 * deleteUser path is unchanged.
 *
 * Callers today:
 *   * requestAccountDeletion (patient settings and doctor settings)
 * There is no admin delete-user action, no cron, and no script that
 * deletes auth users, profiles, doctors, or prescriptions.
 */

export const ACTIVE_BOOKINGS_ERROR =
  "You have active bookings. Please cancel them before deleting your account.";

export const ERASE_FAILED_ERROR =
  "Failed to delete account. Please contact support.";

export const ERASED_BAN_DURATION = "876000h";

const ACTIVE_BOOKING_STATUSES = [
  "confirmed",
  "approved",
  "pending_payment",
  "pending_approval",
] as const;

const FINISHED_BOOKING_STATUSES = [
  "completed",
  "cancelled_patient",
  "cancelled_doctor",
  "no_show",
] as const;

export function erasedAuthEmail(userId: string): string {
  return `erased+${userId}@users.invalid`;
}

export function erasedAuthAdminAttributes(userId: string) {
  return {
    email: erasedAuthEmail(userId),
    email_confirm: true,
    ban_duration: ERASED_BAN_DURATION,
    user_metadata: {
      restricted: true,
      first_name: "",
      last_name: "",
      avatar_url: "",
    },
  };
}

type QueryError = { message: string; code?: string } | null;

type RowList = { data: { id: string }[] | null; error: QueryError };
type RowOne = { data: { id: string } | null; error: QueryError };

export interface EraseFilter extends PromiseLike<RowList> {
  eq: (column: string, value: string) => EraseFilter;
  in: (column: string, values: readonly string[]) => EraseFilter;
  limit: (count: number) => Promise<RowList>;
  maybeSingle: () => Promise<RowOne>;
}

export interface EraseAdmin {
  from: (table: string) => {
    select: (columns: string) => EraseFilter;
    update: (values: Record<string, unknown>) => EraseFilter;
    delete: () => EraseFilter;
  };
  rpc: (
    fn: string,
    args: { p_user_id: string }
  ) => Promise<{ data: unknown; error: QueryError }>;
  auth: {
    admin: {
      deleteUser: (id: string) => Promise<{ error: QueryError }>;
      updateUserById: (
        id: string,
        attributes: Record<string, unknown>
      ) => Promise<{ error: QueryError }>;
    };
  };
}

export type EraseAccountResult =
  | { success: true; mode: "restricted" | "hard_deleted" }
  | { error: string };

function isForeignKeyViolation(error: { message?: string; code?: string }): boolean {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return code === "23503" || message.includes("23503") || message.includes("foreign key");
}

function isMissingEraseRpc(error: { message?: string; code?: string }): boolean {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "PGRST202" ||
    message.includes("could not find the function") ||
    message.includes("schema cache")
  );
}

function isActiveBookingsError(error: { message?: string }): boolean {
  return (error.message ?? "").includes("active_bookings");
}

export function readEraseMode(data: unknown): "restricted" | "hard_delete" | null {
  let value = data;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || !("mode" in value)) return null;
  const mode = (value as { mode: unknown }).mode;
  if (mode === "restricted" || mode === "hard_delete") return mode;
  return null;
}

async function hasActiveBookings(admin: EraseAdmin, userId: string): Promise<boolean> {
  const asPatient = await admin
    .from("bookings")
    .select("id")
    .eq("patient_id", userId)
    .in("status", ACTIVE_BOOKING_STATUSES)
    .limit(1);
  if (asPatient.error) throw new Error(asPatient.error.message);
  if (asPatient.data && asPatient.data.length > 0) return true;

  const doctor = await admin
    .from("doctors")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();
  if (doctor.error) throw new Error(doctor.error.message);
  if (!doctor.data?.id) return false;

  const asDoctor = await admin
    .from("bookings")
    .select("id")
    .eq("doctor_id", doctor.data.id)
    .in("status", ACTIVE_BOOKING_STATUSES)
    .limit(1);
  if (asDoctor.error) throw new Error(asDoctor.error.message);
  return Boolean(asDoctor.data && asDoctor.data.length > 0);
}

const PROFILE_RETAINED_TABLES = [
  ["prescriptions", "patient_id"],
  ["prescription_audit_log", "actor_profile_id"],
  ["reviews", "patient_id"],
  ["bookings", "patient_id"],
  ["wallet_transactions", "patient_id"],
  ["follow_up_invitations", "patient_id"],
  ["reschedule_requests", "requested_by"],
  ["clinic_invitations", "invited_by"],
  ["audit_log", "actor_id"],
  ["payment_correction_approvals", "approver_id"],
  ["payment_correction_approvers", "profile_id"],
  ["doctor_approval_checklist", "reviewer_id"],
] as const;

const DOCTOR_RETAINED_TABLES = [
  ["prescriptions", "doctor_id"],
  ["reviews", "doctor_id"],
  ["bookings", "doctor_id"],
  ["platform_fees", "doctor_id"],
  ["doctor_wallet_credit_transfers", "doctor_id"],
  ["gp_slot_offers", "doctor_id"],
] as const;

async function hasMatchingRow(
  admin: EraseAdmin,
  table: string,
  column: string,
  value: string
): Promise<boolean> {
  const result = await admin.from(table).select(column).eq(column, value).limit(1);
  if (result.error) throw new Error(result.error.message);
  return Boolean(result.data && result.data.length > 0);
}

function isMissingColumn(
  error: { message?: string; code?: string },
  column: string
): boolean {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "42703" ||
    code === "PGRST204" ||
    (message.includes(column) &&
      (message.includes("does not exist") || message.includes("could not find")))
  );
}

async function hasPatientBooking(
  admin: EraseAdmin,
  userId: string,
  status?: string
): Promise<boolean> {
  let query = admin.from("bookings").select("id").eq("patient_id", userId);
  if (status) query = query.eq("status", status);
  const booking = await query.limit(1);
  if (booking.error) throw new Error(booking.error.message);
  return Boolean(booking.data && booking.data.length > 0);
}

/**
 * Fallback share signal when erase_account is not installed.
 * Matches 00135: sharing_consent plus a completed booking. If the
 * column is absent, any booking for that patient counts.
 */
export async function hasSharedMedicalProfile(
  admin: EraseAdmin,
  userId: string
): Promise<boolean> {
  const profile = await admin
    .from("medical_profiles")
    .select("id, sharing_consent")
    .eq("patient_id", userId)
    .limit(1);
  if (profile.error) {
    if (!isMissingColumn(profile.error, "sharing_consent")) {
      throw new Error(profile.error.message);
    }
    const exists = await admin
      .from("medical_profiles")
      .select("id")
      .eq("patient_id", userId)
      .limit(1);
    if (exists.error) throw new Error(exists.error.message);
    if (!exists.data?.length) return false;
    return hasPatientBooking(admin, userId);
  }

  const row = profile.data?.[0] as { sharing_consent?: boolean | null } | undefined;
  if (!row || row.sharing_consent !== true) return false;
  return hasPatientBooking(admin, userId, "completed");
}

async function hasRetainedRecords(admin: EraseAdmin, userId: string): Promise<boolean> {
  for (const [table, column] of PROFILE_RETAINED_TABLES) {
    if (await hasMatchingRow(admin, table, column, userId)) return true;
  }
  if (await hasSharedMedicalProfile(admin, userId)) return true;

  const doctor = await admin.from("doctors").select("id").eq("profile_id", userId).maybeSingle();
  if (doctor.error) throw new Error(doctor.error.message);
  if (!doctor.data?.id) return false;

  for (const [table, column] of DOCTOR_RETAINED_TABLES) {
    if (await hasMatchingRow(admin, table, column, doctor.data.id)) return true;
  }
  return false;
}

function clearEphemeraForHardDelete(admin: EraseAdmin, userId: string): Promise<unknown> {
  return Promise.allSettled([
    admin.from("push_subscriptions").delete().eq("user_id", userId),
    admin.from("cookie_consents").delete().eq("user_id", userId),
    admin.from("availability_alerts").delete().eq("patient_id", userId),
    admin.from("specialty_waitlist").delete().eq("patient_id", userId),
    admin
      .from("bookings")
      .update({ patient_notes: null })
      .eq("patient_id", userId)
      .in("status", FINISHED_BOOKING_STATUSES),
  ]);
}

async function banErasedAuthUser(
  admin: EraseAdmin,
  userId: string
): Promise<{ error: QueryError }> {
  return admin.auth.admin.updateUserById(userId, erasedAuthAdminAttributes(userId));
}

async function finishRestricted(
  admin: EraseAdmin,
  userId: string
): Promise<EraseAccountResult> {
  const banned = await banErasedAuthUser(admin, userId);
  if (banned.error) {
    log.error("Restricted account but failed to ban the auth user", {
      userId,
      err: banned.error.message,
    });
    return { error: ERASE_FAILED_ERROR };
  }
  return { success: true, mode: "restricted" };
}

async function hardDelete(admin: EraseAdmin, userId: string): Promise<EraseAccountResult> {
  await clearEphemeraForHardDelete(admin, userId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (!error) return { success: true, mode: "hard_deleted" };

  if (isForeignKeyViolation(error)) {
    const retry = await admin.rpc("erase_account", { p_user_id: userId });
    if (!retry.error && readEraseMode(retry.data) === "restricted") {
      return finishRestricted(admin, userId);
    }
  }

  log.error("auth.admin.deleteUser failed", { userId, err: error.message });
  return { error: ERASE_FAILED_ERROR };
}

export async function eraseAccount(
  userId: string,
  admin: EraseAdmin = createAdminClient() as unknown as EraseAdmin
): Promise<EraseAccountResult> {
  try {
    if (await hasActiveBookings(admin, userId)) {
      return { error: ACTIVE_BOOKINGS_ERROR };
    }
  } catch (err) {
    log.error("Failed to check active bookings before erasure", { userId, err });
    return { error: ERASE_FAILED_ERROR };
  }

  const rpc = await admin.rpc("erase_account", { p_user_id: userId });
  if (rpc.error) {
    if (isActiveBookingsError(rpc.error)) return { error: ACTIVE_BOOKINGS_ERROR };
    if (isMissingEraseRpc(rpc.error)) {
      try {
        if (await hasRetainedRecords(admin, userId)) {
          log.error("erase_account is missing and retained rows exist", {
            userId,
          });
          return { error: ERASE_FAILED_ERROR };
        }
      } catch (err) {
        log.error("Failed to check retained prescriptions", { userId, err });
        return { error: ERASE_FAILED_ERROR };
      }
      return hardDelete(admin, userId);
    }
    log.error("erase_account failed", { userId, err: rpc.error.message });
    return { error: ERASE_FAILED_ERROR };
  }

  const mode = readEraseMode(rpc.data);
  if (mode === "restricted") return finishRestricted(admin, userId);
  if (mode === "hard_delete") return hardDelete(admin, userId);

  log.error("erase_account returned an unknown mode", { userId });
  return { error: ERASE_FAILED_ERROR };
}
