import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * System actor for `audit_log` rows written by jobs, not by a signed-in admin.
 *
 * `audit_log.actor_id` is `UUID NOT NULL REFERENCES profiles(id)`
 * (supabase/migrations/00009_create_extras.sql). Profiles roles are only
 * `patient`, `doctor`, and `admin`. There is no nullable actor and no system
 * role, so a cron cannot insert a row without a real profile id.
 *
 * Resolution, without a migration:
 * 1. `AUDIT_SYSTEM_ACTOR_ID`, when it is a UUID. Point this at an existing
 *    profile (a dedicated ops user created in Supabase, not by a migration).
 *    The foreign key still requires that row to exist; a wrong id fails the
 *    insert and the caller logs it.
 * 2. Otherwise the oldest `profiles` row with `role = 'admin'`. The
 *    service-role client can read it. Metadata on the audit row must set
 *    `actor_kind` to `"system"` so the admin audit page, which joins this
 *    profile and shows a name, is not read as a human click.
 */
export const AUDIT_SYSTEM_ACTOR_ENV = "AUDIT_SYSTEM_ACTOR_ID";

const ACTOR_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SystemActorVia = "AUDIT_SYSTEM_ACTOR_ID" | "admin_profile_fallback";

export type SystemActor = {
  actorId: string;
  via: SystemActorVia;
};

export function configuredAuditSystemActorId(
  env: Record<string, string | undefined> = process.env
): string | null {
  const raw = env[AUDIT_SYSTEM_ACTOR_ENV]?.trim() ?? "";
  if (!ACTOR_ID_RE.test(raw)) return null;
  return raw;
}

export async function resolveAuditSystemActor(
  supabase: SupabaseClient
): Promise<SystemActor | null> {
  const configured = configuredAuditSystemActorId();
  if (configured) {
    return { actorId: configured, via: "AUDIT_SYSTEM_ACTOR_ID" };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const id = data && typeof data.id === "string" ? data.id : null;
  if (error || !id) return null;
  return { actorId: id, via: "admin_profile_fallback" };
}
