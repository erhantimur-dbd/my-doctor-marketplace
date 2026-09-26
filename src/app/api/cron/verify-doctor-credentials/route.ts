import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import {
  indemnityExpiryChaseEmail,
  credentialsSuspendedEmail,
} from "@/lib/email/templates";
import { resolveAuditSystemActor } from "@/lib/audit/system-actor";
import {
  SOFTSMOKE_CREDENTIALS_SKIP_REASON,
  isSoftLaunchSoftsmokeCredentialsSkip,
} from "@/lib/soft-launch/softsmoke-connect-bypass";
import {
  cqcErrorHttpStatus,
  fetchCqcProvider,
  isDefinitiveCqcNotFound,
  type CqcFetchError,
} from "@/lib/verification/cqc";
import { log } from "@/lib/utils/logger";
import { authorizeCronRequest } from "@/lib/cron/authorize";

/**
 * Daily verification cron for UK-practising doctors.
 *
 * Part of Workstream 2 of the UK CQC compliance plan. Runs once per day at
 * 04:00 UTC (see vercel.json). The work is cheap — typically a handful of
 * outbound fetches and one or two email sends — but the hard deadlines are
 * 30 days before indemnity expiry and the day-of expiry, so daily cadence
 * is needed to catch those windows reliably.
 *
 * What it does, for every doctor where `practising_country = 'GB'`:
 *
 * 1. If `cqc_status = 'registered'` and `cqc_provider_id` is set, re-check
 *    the CQC Syndication API. Suspend only when the register says the
 *    provider is deregistered, or returns a real HTTP 404 for that id.
 *    Timeouts, network errors, HTTP 429, any 5xx, and unreadable or
 *    malformed bodies are logged and left unchanged so the next night
 *    retries. A successful `Registered` result refreshes `cqc_verified_at`.
 *
 * 2. If `indemnity_expiry` is within 30 days but still in the future, send
 *    a chase email. Deduplicated via `compliance_notifications_sent` so we
 *    don't spam the doctor on successive cron runs.
 *
 * 3. If `indemnity_expiry` is past, suspend the listing and email them. The
 *    suspension is implemented as `verification_status = 'suspended'` which
 *    hides the doctor from listing queries (the existing `is_active` flag is
 *    left alone so the admin can see the context in the admin panel).
 *
 * 4. If `dbs_check_date` is set but more than 3 years old, flag it as part
 *    of the suspension reasons too (DBS is not strictly compulsory for all
 *    UK patient-facing work, but a lapsed DBS beyond the 3-year standard is
 *    a red flag worth surfacing).
 *
 * The Softsmoke test doctor is skipped for the CQC re-check and for every
 * auto-suspension when `SOFT_LAUNCH_SOFTSMOKE_CREDENTIALS_SKIP=1`. The match
 * is by doctor id only. Unset does not skip.
 *
 * Each successful auto-suspension writes `audit_log` (`doctor_auto_suspended`).
 * See `resolveAuditSystemActor` for how `actor_id` is chosen without a
 * migration.
 *
 * Protected by `CRON_SECRET` in the Authorization header, same as the other
 * crons under `src/app/api/cron/`. Returns a JSON summary of actions taken.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const INDEMNITY_CHASE_WINDOW_DAYS = 30;
const DBS_MAX_AGE_YEARS = 3;
const INCONCLUSIVE_CQC =
  "[verify-doctor-credentials] CQC check inconclusive; doctor left unchanged";

type DoctorProfile = {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

type DoctorRow = {
  id: string;
  profile_id: string;
  verification_status: string | null;
  cqc_status: string | null;
  cqc_provider_id: string | null;
  indemnity_insurer: string | null;
  indemnity_expiry: string | null;
  dbs_check_date: string | null;
  profile: DoctorProfile | DoctorProfile[] | null;
};

type CqcCheckSnapshot = {
  providerId: string;
  httpStatus: number | null;
  registrationStatus: string | null;
  errorKind: string | null;
};

export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const supabase = createAdminClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const systemActor = await resolveAuditSystemActor(supabase);

  const { data: doctors, error: doctorsError } = await supabase
    .from("doctors")
    .select(
      `
      id,
      profile_id,
      verification_status,
      practising_country,
      cqc_status,
      cqc_provider_id,
      cqc_location_id,
      cqc_verified_at,
      indemnity_insurer,
      indemnity_expiry,
      dbs_check_date,
      profile:profiles!doctors_profile_id_fkey(first_name, last_name, email)
      `
    )
    .eq("practising_country", "GB");

  if (doctorsError || !doctors) {
    log.error("[verify-doctor-credentials] Query failed", {
      err: doctorsError,
    });
    return NextResponse.json(
      {
        ok: false,
        error: doctorsError?.message || "Query failed",
      },
      { status: 500 }
    );
  }

  let checked = 0;
  let cqcRefreshed = 0;
  let cqcSuspended = 0;
  let indemnityChased = 0;
  let indemnitySuspended = 0;
  let dbsWarnings = 0;

  for (const raw of doctors as DoctorRow[]) {
    // Supabase returns nested joins as arrays in some cases; resolve once.
    const profile: DoctorProfile | null = Array.isArray(raw.profile)
      ? (raw.profile[0] ?? null)
      : raw.profile;

    const doctorName = [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(" ")
      .trim() || "Doctor";

    checked++;

    const skipCredentials = isSoftLaunchSoftsmokeCredentialsSkip(raw.id);
    if (skipCredentials) {
      log.info(
        "[verify-doctor-credentials] Skipping CQC re-check and auto-suspension",
        {
          doctor_id: raw.id,
          reason: SOFTSMOKE_CREDENTIALS_SKIP_REASON,
        }
      );
    }

    const suspensionReasons: string[] = [];
    let cqcCheck: CqcCheckSnapshot | null = null;

    // ── 1. CQC re-verification ──────────────────────────────────────────
    if (
      !skipCredentials &&
      raw.cqc_status === "registered" &&
      raw.cqc_provider_id
    ) {
      const providerId = raw.cqc_provider_id;
      const result = await fetchCqcProvider(providerId);
      if (result.ok) {
        cqcCheck = {
          providerId,
          httpStatus: 200,
          registrationStatus: result.data.registrationStatus,
          errorKind: null,
        };
        if (result.data.registrationStatus === "Deregistered") {
          suspensionReasons.push(
            `CQC provider ID ${providerId} is deregistered on the CQC register.`
          );
          cqcSuspended++;
        } else if (result.data.registrationStatus === "Registered") {
          await supabase
            .from("doctors")
            .update({ cqc_verified_at: nowIso })
            .eq("id", raw.id);
          cqcRefreshed++;
        } else {
          log.warn(INCONCLUSIVE_CQC, {
            doctor_id: raw.id,
            cqc_provider_id: providerId,
            http_status: 200,
            registration_status: result.data.registrationStatus,
            error_kind: null,
          });
        }
      } else if (isDefinitiveCqcNotFound(result.error)) {
        cqcCheck = {
          providerId,
          httpStatus: 404,
          registrationStatus: null,
          errorKind: "not_found",
        };
        suspensionReasons.push(
          `CQC provider ID ${providerId} was not found on the CQC register (HTTP 404).`
        );
        cqcSuspended++;
      } else {
        const httpStatus = cqcErrorHttpStatus(result.error);
        cqcCheck = {
          providerId,
          httpStatus,
          registrationStatus: null,
          errorKind: result.error.kind,
        };
        log.warn(INCONCLUSIVE_CQC, inconclusiveDetails(raw.id, providerId, result.error));
      }
    }

    // ── 2. Indemnity chase / expiry ─────────────────────────────────────
    if (raw.indemnity_expiry) {
      const expiryDate = new Date(`${raw.indemnity_expiry}T00:00:00Z`);
      const daysUntilExpiry = Math.ceil(
        (expiryDate.getTime() - now.getTime()) / DAY_MS
      );

      if (daysUntilExpiry <= 0) {
        if (!skipCredentials) {
          suspensionReasons.push(
            `Professional indemnity certificate expired on ${raw.indemnity_expiry}.`
          );
          indemnitySuspended++;
        }
      } else if (daysUntilExpiry <= INDEMNITY_CHASE_WINDOW_DAYS) {
        // Deduplicate via compliance_notifications_sent to avoid daily spam.
        const notificationKey = `indemnity_chase:${raw.indemnity_expiry}`;
        const { data: existing } = await supabase
          .from("compliance_notifications_sent")
          .select("id")
          .eq("doctor_id", raw.id)
          .eq("notification_key", notificationKey)
          .maybeSingle();

        if (!existing && profile?.email) {
          const { subject, html } = indemnityExpiryChaseEmail({
            doctorName,
            insurer: raw.indemnity_insurer,
            expiryDate: raw.indemnity_expiry,
            daysUntilExpiry,
          });
          await sendEmail({ to: profile.email, subject, html });
          await supabase.from("compliance_notifications_sent").insert({
            doctor_id: raw.id,
            notification_key: notificationKey,
            sent_at: nowIso,
          });
          indemnityChased++;
        }
      }
    }

    // ── 3. DBS check age ────────────────────────────────────────────────
    if (raw.dbs_check_date) {
      const dbsDate = new Date(`${raw.dbs_check_date}T00:00:00Z`);
      const ageYears = (now.getTime() - dbsDate.getTime()) / (DAY_MS * 365.25);
      if (ageYears > DBS_MAX_AGE_YEARS) {
        dbsWarnings++;
        // Not an automatic suspension — platforms disagree on how recent a
        // DBS must be — but we flag it for admin visibility via the audit
        // log and include it in the suspension email IF another reason
        // already triggered suspension.
        if (suspensionReasons.length > 0) {
          suspensionReasons.push(
            `DBS check from ${raw.dbs_check_date} is more than ${DBS_MAX_AGE_YEARS} years old.`
          );
        }
      }
    }

    // ── 4. Apply suspension if any hard reason accumulated ──────────────
    if (
      !skipCredentials &&
      suspensionReasons.length > 0 &&
      raw.verification_status !== "suspended"
    ) {
      const { error: updateError } = await supabase
        .from("doctors")
        .update({ verification_status: "suspended" })
        .eq("id", raw.id);

      if (!updateError) {
        log.info("[verify-doctor-credentials] Doctor auto-suspended", {
          doctor_id: raw.id,
          reasons: suspensionReasons,
        });

        if (systemActor) {
          const { error: auditError } = await supabase.from("audit_log").insert({
            actor_id: systemActor.actorId,
            action: "doctor_auto_suspended",
            target_type: "doctor",
            target_id: raw.id,
            metadata: {
              reason: suspensionReasons.join("; "),
              cqc_provider_id: cqcCheck?.providerId ?? null,
              register_response: {
                http_status: cqcCheck?.httpStatus ?? null,
                registration_status: cqcCheck?.registrationStatus ?? null,
                error_kind: cqcCheck?.errorKind ?? null,
              },
              actor_kind: "system",
              actor_resolution: systemActor.via,
              source: "verify-doctor-credentials",
            },
          });
          if (auditError) {
            log.error("[verify-doctor-credentials] audit_log insert failed", {
              doctor_id: raw.id,
              err: auditError,
            });
          }
        } else {
          // actor_id is NOT NULL and references profiles. Without a configured
          // system profile or an admin profile there is no legal insert.
          log.error(
            "[verify-doctor-credentials] audit_log skipped; no profile available for actor_id",
            { doctor_id: raw.id, reasons: suspensionReasons }
          );
        }

        if (profile?.email) {
          const { subject, html } = credentialsSuspendedEmail({
            doctorName,
            reasons: suspensionReasons,
          });
          await sendEmail({ to: profile.email, subject, html });
        }
      } else {
        log.error("[verify-doctor-credentials] Suspend update failed", {
          doctor_id: raw.id,
          err: updateError,
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    checked,
    cqc_refreshed: cqcRefreshed,
    cqc_suspended: cqcSuspended,
    indemnity_chased: indemnityChased,
    indemnity_suspended: indemnitySuspended,
    dbs_warnings: dbsWarnings,
    ran_at: nowIso,
  });
}

function inconclusiveDetails(
  doctorId: string,
  providerId: string,
  error: CqcFetchError
) {
  return {
    doctor_id: doctorId,
    cqc_provider_id: providerId,
    http_status: cqcErrorHttpStatus(error),
    registration_status: null,
    error_kind: error.kind,
  };
}
