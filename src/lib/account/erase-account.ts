import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/utils/logger";

/**
 * Single account-erasure entry point.
 *
 * erase_account restricts the account when deleteUser would fail with
 * 23503, and when a prescription, a shared medical profile, a review, an
 * invoice, a payment, a message, a membership, a wallet, or another
 * non-cascading row must stay. Review text is removed and the rating
 * stays. The author name is cleared. Otherwise the historical deleteUser
 * path is unchanged.
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

export const ERASURE_BLOCKED_ERROR =
  "Cancel your subscription or contact support before deleting your account.";

export type ErasureBlockReason = "stripe_subscription" | "active_licence" | "org_owner";

/** Buckets and prefixes deleted with the service-role storage API. */
export const ACCOUNT_STORAGE_PREFIXES = {
  avatars: "{userId}/",
  "public-read": "{userId}/",
} as const;

const STORAGE_PAGE_SIZE = 1000;

/** RFC 4122 UUID. Empty and neighbouring strings must not reach storage. */
const ERASURE_USER_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function accountStoragePrefix(userId: string): string {
  if (!ERASURE_USER_ID.test(userId)) {
    throw new Error("Account erasure requires a UUID user id");
  }
  return `${userId.toLowerCase()}/`;
}

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

type EraseRow = { id?: string; [key: string]: unknown };

type RowList = { data: EraseRow[] | null; error: QueryError };
type RowOne = { data: EraseRow | null; error: QueryError };

export interface StorageListEntry {
  name: string;
  id: string | null;
}

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
  storage: {
    from: (bucket: string) => {
      list: (
        prefix: string,
        options?: { limit?: number; offset?: number }
      ) => Promise<{ data: StorageListEntry[] | null; error: QueryError }>;
      remove: (paths: string[]) => Promise<{ error: QueryError }>;
    };
  };
}

export type EraseAccountResult =
  | {
      success: true;
      mode: "restricted" | "hard_deleted";
      fallbackReason?: "open_dispute";
    }
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

function isErasureBlockedError(error: { message?: string }): boolean {
  return (error.message ?? "").toLowerCase().includes("erasure_blocked");
}

function isMissingRelation(error: { message?: string; code?: string }): boolean {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("could not find the table") ||
    (message.includes("does not exist") &&
      (message.includes("relation") || message.includes("table")))
  );
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

export function readEraseFallbackReason(data: unknown): "open_dispute" | null {
  let value = data;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object" || !("fallback_reason" in value)) return null;
  return (value as { fallback_reason: unknown }).fallback_reason === "open_dispute"
    ? "open_dispute"
    : null;
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
  ["invoices", "patient_id"],
  ["payments", "patient_id"],
  ["treatment_plans", "patient_id"],
  ["conversations", "patient_id"],
  ["direct_messages", "sender_id"],
  ["organization_members", "user_id"],
  ["patient_wallet", "patient_id"],
] as const;

const DOCTOR_RETAINED_TABLES = [
  ["prescriptions", "doctor_id"],
  ["reviews", "doctor_id"],
  ["bookings", "doctor_id"],
  ["platform_fees", "doctor_id"],
  ["doctor_wallet_credit_transfers", "doctor_id"],
  ["gp_slot_offers", "doctor_id"],
  ["doctor_subscriptions", "doctor_id"],
  ["invoices", "doctor_id"],
  ["payments", "doctor_id"],
  ["treatment_plans", "doctor_id"],
  ["conversations", "doctor_id"],
] as const;

const LIVE_MEMBER_STATUSES = ["active", "invited", "suspended"] as const;

async function hasMatchingRow(
  admin: EraseAdmin,
  table: string,
  column: string,
  value: string
): Promise<boolean> {
  const result = await admin.from(table).select(column).eq(column, value).limit(1);
  if (result.error) {
    if (isMissingRelation(result.error)) return false;
    throw new Error(result.error.message);
  }
  return Boolean(result.data && result.data.length > 0);
}

function textField(row: EraseRow, key: string): string {
  const value = row[key];
  return typeof value === "string" ? value : "";
}

async function rowsWhere(
  admin: EraseAdmin,
  table: string,
  column: string,
  value: string,
  columns: string
): Promise<EraseRow[] | "missing"> {
  const result = await admin.from(table).select(columns).eq(column, value).limit(100);
  if (result.error) {
    if (isMissingRelation(result.error)) return "missing";
    throw new Error(result.error.message);
  }
  return result.data ?? [];
}

/**
 * Why erasure must stop before any write. Null when the account can proceed.
 * Overlap returns the first matching reason.
 */
export async function findErasureBlock(
  admin: EraseAdmin,
  userId: string
): Promise<ErasureBlockReason | null> {
  const doctor = await admin.from("doctors").select("id").eq("profile_id", userId).maybeSingle();
  if (doctor.error) {
    if (!isMissingRelation(doctor.error)) throw new Error(doctor.error.message);
  } else if (doctor.data?.id) {
    const subs = await rowsWhere(
      admin,
      "doctor_subscriptions",
      "doctor_id",
      doctor.data.id,
      "id, status"
    );
    if (
      subs !== "missing" &&
      subs.some((row) => {
        const status = textField(row, "status");
        return status === "active" || status === "trialing";
      })
    ) {
      return "stripe_subscription";
    }
  }

  const memberships = await rowsWhere(
    admin,
    "organization_members",
    "user_id",
    userId,
    "id, organization_id, role, status"
  );
  if (memberships === "missing") return null;

  const activeMemberships = memberships.filter((row) => textField(row, "status") === "active");
  const orgIds = [
    ...new Set(
      activeMemberships
        .map((row) => textField(row, "organization_id"))
        .filter((orgId) => orgId.length > 0)
    ),
  ];
  const licencesByOrg = new Map<string, EraseRow[]>();
  for (const orgId of orgIds) {
    const licences = await rowsWhere(admin, "licenses", "organization_id", orgId, "id, status");
    licencesByOrg.set(orgId, licences === "missing" ? [] : licences);
  }

  for (const licences of licencesByOrg.values()) {
    if (licences.some((row) => textField(row, "status") === "trialing")) {
      return "stripe_subscription";
    }
  }
  for (const licences of licencesByOrg.values()) {
    if (licences.some((row) => textField(row, "status") === "active")) {
      return "active_licence";
    }
  }

  for (const membership of activeMemberships) {
    if (textField(membership, "role") !== "owner") continue;
    const orgId = textField(membership, "organization_id");
    if (!orgId) continue;
    const members = await rowsWhere(
      admin,
      "organization_members",
      "organization_id",
      orgId,
      "id, user_id, status"
    );
    if (members !== "missing") {
      const others = members.filter(
        (row) =>
          textField(row, "user_id") !== userId &&
          LIVE_MEMBER_STATUSES.includes(
            textField(row, "status") as (typeof LIVE_MEMBER_STATUSES)[number]
          )
      );
      if (others.length > 0) return "org_owner";
    }
    const licences = licencesByOrg.get(orgId) ?? [];
    if (licences.some((row) => textField(row, "status") === "active")) return "org_owner";
  }

  return null;
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

async function updateRows(
  admin: EraseAdmin,
  table: string,
  values: Record<string, unknown>,
  filters: Record<string, string>
): Promise<QueryError> {
  let query = admin.from(table).update(values);
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }
  const result = await query;
  return result.error;
}

function isBrandColumnMissing(error: { message?: string; code?: string }): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (error.code === "42703" || error.code === "PGRST204" || message.includes("does not exist")) &&
    message.includes("brand_");
}

async function scrubOrganization(admin: EraseAdmin, orgId: string): Promise<void> {
  const identifying: Record<string, unknown> = {
    name: "",
    email: null,
    phone: null,
    slug: `erased-${orgId}`,
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    postal_code: null,
    country: null,
    website: null,
    logo_url: null,
    description: null,
    brand_display_name: "",
    brand_support_email: null,
    brand_support_phone: null,
  };
  let error = await updateRows(admin, "organizations", identifying, { id: orgId });
  if (error && isBrandColumnMissing(error)) {
    const withoutBrand: Record<string, unknown> = {
      name: "",
      email: null,
      phone: null,
      slug: `erased-${orgId}`,
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      postal_code: null,
      country: null,
      website: null,
      logo_url: null,
      description: null,
    };
    error = await updateRows(admin, "organizations", withoutBrand, { id: orgId });
  }
  if (error && !isMissingRelation(error)) {
    log.error("Failed to scrub organisation identity", { orgId, err: error.message });
  }
}

/** Deactivate an active owner membership. A sole member's clinic identity is cleared. */
export async function releaseOrgOwnership(admin: EraseAdmin, userId: string): Promise<void> {
  try {
    const memberships = await rowsWhere(
      admin,
      "organization_members",
      "user_id",
      userId,
      "id, organization_id, role, status"
    );
    if (memberships === "missing") return;
    const owned = memberships.filter(
      (row) => textField(row, "role") === "owner" && textField(row, "status") === "active"
    );
    for (const membership of owned) {
      const orgId = textField(membership, "organization_id");
      if (!orgId) continue;
      const members = await rowsWhere(
        admin,
        "organization_members",
        "organization_id",
        orgId,
        "id, user_id, status"
      );
      const others =
        members === "missing"
          ? []
          : members.filter((row) => {
              if (textField(row, "user_id") === userId) return false;
              const status = textField(row, "status");
              return status === "active" || status === "invited" || status === "suspended";
            });
      if (others.length > 0) continue;
      await scrubOrganization(admin, orgId);
      const error = await updateRows(
        admin,
        "organization_members",
        { status: "suspended" },
        { organization_id: orgId, user_id: userId, role: "owner", status: "active" }
      );
      if (error && !isMissingRelation(error)) {
        log.error("Failed to suspend organisation owner", { userId, orgId, err: error.message });
      }
    }
  } catch (err) {
    log.error("Failed to release organisation ownership", { userId, err });
  }
}

function storageChildPath(prefix: string, name: string): string {
  if (!name || name === "." || name === ".." || name.includes("/") || name.includes("\\")) {
    throw new Error("Refusing to delete storage outside the user prefix");
  }
  const base = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return `${base}/${name}`;
}

async function listObjectPaths(
  bucket: ReturnType<EraseAdmin["storage"]["from"]>,
  prefix: string,
  requiredPrefix: string
): Promise<string[]> {
  if (!prefix.startsWith(requiredPrefix)) return [];
  const paths: string[] = [];
  let offset = 0;
  for (;;) {
    const listed = await bucket.list(prefix, { limit: STORAGE_PAGE_SIZE, offset });
    if (listed.error || !listed.data) {
      if (listed.error) {
        log.error("Failed to list account storage", { prefix, offset, err: listed.error.message });
      }
      break;
    }
    for (const entry of listed.data) {
      if (!entry.name) continue;
      const path = storageChildPath(prefix, entry.name);
      if (!path.startsWith(requiredPrefix)) {
        throw new Error("Refusing to delete storage outside the user prefix");
      }
      if (entry.id == null) {
        paths.push(...(await listObjectPaths(bucket, `${path}/`, requiredPrefix)));
      } else {
        paths.push(path);
      }
    }
    if (listed.data.length < STORAGE_PAGE_SIZE) break;
    offset += STORAGE_PAGE_SIZE;
  }
  return paths;
}

async function removeBucketPrefix(admin: EraseAdmin, bucketName: string, prefix: string): Promise<void> {
  const bucket = admin.storage.from(bucketName);
  const paths = await listObjectPaths(bucket, prefix, prefix);
  if (paths.some((path) => !path.startsWith(prefix))) {
    throw new Error("Refusing to delete storage outside the user prefix");
  }
  for (let start = 0; start < paths.length; start += STORAGE_PAGE_SIZE) {
    const batch = paths.slice(start, start + STORAGE_PAGE_SIZE).filter((path) => path.startsWith(prefix));
    if (batch.length === 0) continue;
    const removed = await bucket.remove(batch);
    if (removed.error) {
      log.error("Failed to delete account storage", {
        bucket: bucketName,
        prefix,
        err: removed.error.message,
      });
    }
  }
}

/**
 * Delete the user's avatar and public doctor media. Message attachments
 * stay: the restricted path keeps the conversation, and those files are
 * part of the doctor's clinical record.
 * A storage failure is logged and does not undo the account close.
 */
export async function deleteAccountStorage(admin: EraseAdmin, userId: string): Promise<void> {
  const prefix = accountStoragePrefix(userId);
  try {
    await removeBucketPrefix(admin, "avatars", prefix);
    await removeBucketPrefix(admin, "public-read", prefix);
  } catch (err) {
    log.error("Failed to delete account storage", { userId, err });
  }
}

async function finishRestricted(
  admin: EraseAdmin,
  userId: string,
  fallbackReason: "open_dispute" | null = null
): Promise<EraseAccountResult> {
  await releaseOrgOwnership(admin, userId);
  await deleteAccountStorage(admin, userId);
  const banned = await banErasedAuthUser(admin, userId);
  if (banned.error) {
    log.error("Restricted account but failed to ban the auth user", {
      userId,
      err: banned.error.message,
    });
    return { error: ERASE_FAILED_ERROR };
  }
  if (fallbackReason === "open_dispute") {
    return { success: true, mode: "restricted", fallbackReason };
  }
  return { success: true, mode: "restricted" };
}

async function hardDelete(admin: EraseAdmin, userId: string): Promise<EraseAccountResult> {
  await deleteAccountStorage(admin, userId);
  await clearEphemeraForHardDelete(admin, userId);
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (!error) return { success: true, mode: "hard_deleted" };

  if (isForeignKeyViolation(error)) {
    const retry = await admin.rpc("erase_account", { p_user_id: userId });
    if (!retry.error && readEraseMode(retry.data) === "restricted") {
      return finishRestricted(admin, userId, readEraseFallbackReason(retry.data));
    }
  }

  log.error("auth.admin.deleteUser failed", { userId, err: error.message });
  return { error: ERASE_FAILED_ERROR };
}

export async function eraseAccount(
  userId: string,
  admin: EraseAdmin = createAdminClient() as unknown as EraseAdmin
): Promise<EraseAccountResult> {
  accountStoragePrefix(userId);
  try {
    if (await hasActiveBookings(admin, userId)) {
      return { error: ACTIVE_BOOKINGS_ERROR };
    }
    const block = await findErasureBlock(admin, userId);
    if (block) {
      log.info("Account erasure blocked", { userId, reason: block });
      return { error: ERASURE_BLOCKED_ERROR };
    }
  } catch (err) {
    log.error("Failed to check active bookings before erasure", { userId, err });
    return { error: ERASE_FAILED_ERROR };
  }

  const rpc = await admin.rpc("erase_account", { p_user_id: userId });
  if (rpc.error) {
    if (isActiveBookingsError(rpc.error)) return { error: ACTIVE_BOOKINGS_ERROR };
    if (isErasureBlockedError(rpc.error)) return { error: ERASURE_BLOCKED_ERROR };
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
  if (mode === "restricted") {
    return finishRestricted(admin, userId, readEraseFallbackReason(rpc.data));
  }
  if (mode === "hard_delete") {
    try {
      if (await hasRetainedRecords(admin, userId)) return finishRestricted(admin, userId);
    } catch (err) {
      log.error("Failed to confirm retained rows before hard delete", { userId, err });
      return { error: ERASE_FAILED_ERROR };
    }
    return hardDelete(admin, userId);
  }

  log.error("erase_account returned an unknown mode", { userId });
  return { error: ERASE_FAILED_ERROR };
}
