import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/client";
import { getStripe } from "@/lib/stripe/client";
import { authorizeCronRequest } from "@/lib/cron/authorize";
import { chooseServiceRecipient } from "@/lib/offers/allowlist";
import { priceNoticeDue, trialReminderDue } from "@/lib/offers/dates";
import {
  deliverIdempotentServiceEmail,
  priceChangeNoticeKey,
  suppressedAuditKey,
  trialReminderKey,
  type ServiceEmailLog,
} from "@/lib/offers/email-idempotency";
import {
  priceChangeNoticeEmail,
  trialChargeReminderEmail,
} from "@/lib/offers/service-email-templates";
import { PLAN_LABEL, type AnnualPlanId } from "@/lib/offers/plans";
import { unitAmountPence } from "@/lib/offers/subscription-price";
import { isStripeTestMode } from "@/lib/offers/stripe-mode";
import { log } from "@/lib/utils/logger";

function missingRelation(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return (error.message || "").toLowerCase().includes("does not exist");
}

function emailLog(admin: ReturnType<typeof createAdminClient>): ServiceEmailLog {
  return {
    async claim(row) {
      const { error } = await admin.from("service_email_sends").insert({
        idempotency_key: row.idempotencyKey,
        event_kind: row.eventKind,
        stripe_subscription_id: row.stripeSubscriptionId,
        recipient_email: row.recipientEmail,
        status: "pending",
      });
      if (error?.code === "23505") return "duplicate";
      if (error) throw error;
      return "claimed";
    },
    async complete(idempotencyKey, status) {
      await admin
        .from("service_email_sends")
        .update({ status })
        .eq("idempotency_key", idempotencyKey);
    },
    async release(idempotencyKey) {
      await admin
        .from("service_email_sends")
        .delete()
        .eq("idempotency_key", idempotencyKey)
        .eq("status", "pending");
    },
    async recordSuppressed(row) {
      const { error } = await admin.from("service_email_sends").insert({
        idempotency_key: suppressedAuditKey(row.idempotencyKey),
        event_kind: row.eventKind,
        stripe_subscription_id: row.stripeSubscriptionId,
        recipient_email: row.recipientEmail,
        status: "suppressed",
      });
      if (error) {
        log.error("Suppressed service-email audit row failed", { err: error });
      }
    },
  };
}

async function recipientEmails(
  admin: ReturnType<typeof createAdminClient>,
  organizationId: string | null
): Promise<string[]> {
  if (!organizationId) return [];
  const emails: string[] = [];
  const { data: org } = await admin
    .from("organizations")
    .select("email")
    .eq("id", organizationId)
    .maybeSingle();
  if (org?.email) emails.push(org.email);
  const { data: doctors } = await admin
    .from("doctors")
    .select("profile:profiles!doctors_profile_id_fkey(email)")
    .eq("organization_id", organizationId);
  for (const doctor of doctors || []) {
    const profile = doctor.profile as { email?: string } | { email?: string }[] | null;
    const row = Array.isArray(profile) ? profile[0] : profile;
    if (row?.email) emails.push(row.email);
  }
  return emails;
}

export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const admin = createAdminClient();
  const now = new Date();
  const logBook = emailLog(admin);
  const counts = { sent: 0, suppressed: 0, duplicate: 0, failed: 0 };

  const { data: trials, error: trialError } = await admin
    .from("licenses")
    .select(
      "id, organization_id, stripe_subscription_id, trial_ends_at, status, billing_period, offer_id, tier"
    )
    .eq("status", "trialing")
    .not("trial_ends_at", "is", null);

  if (trialError && missingRelation(trialError)) {
    return NextResponse.json({ skipped: "migration_pending" });
  }
  if (trialError) {
    log.error("Trial reminder query failed", { err: trialError });
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  for (const license of trials || []) {
    if (!license.stripe_subscription_id || !license.trial_ends_at) continue;
    if (license.billing_period !== "annual" && !license.offer_id) continue;
    if (!trialReminderDue(new Date(license.trial_ends_at), now)) continue;
    const recipient = chooseServiceRecipient(
      await recipientEmails(admin, license.organization_id)
    );
    if (!recipient) continue;
    const tier = license.tier === "professional" ? "professional" : "starter";
    const planId = tier === "professional" ? "professional_annual" : "starter_annual";
    const amountPence = await subscriptionChargePence(license.stripe_subscription_id);
    if (amountPence == null) {
      log.error("Trial reminder skipped: subscription price missing", {
        subscriptionId: license.stripe_subscription_id,
      });
      continue;
    }
    const { subject, html } = trialChargeReminderEmail({
      planLabel: PLAN_LABEL[planId as AnnualPlanId],
      amountPence,
      chargeOn: new Date(license.trial_ends_at),
    });
    const status = await deliverIdempotentServiceEmail(logBook, sendEmail, {
      claim: {
        idempotencyKey: trialReminderKey(license.stripe_subscription_id),
        eventKind: "trial_reminder_7d",
        stripeSubscriptionId: license.stripe_subscription_id,
        recipientEmail: recipient.to,
      },
      allowed: recipient.allowed,
      subject,
      html,
    });
    counts[status] += 1;
  }

  const { data: schedules, error: scheduleError } = await admin
    .from("subscription_price_schedules")
    .select(
      "stripe_schedule_id, stripe_subscription_id, organization_id, plan_id, from_amount_pence, to_amount_pence, switch_at, notice_due_at"
    );

  if (scheduleError && missingRelation(scheduleError)) {
    return NextResponse.json({ ...counts, skipped: "schedules_pending" });
  }
  if (scheduleError) {
    log.error("Price notice query failed", { err: scheduleError });
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  for (const schedule of schedules || []) {
    if (
      !priceNoticeDue(new Date(schedule.notice_due_at), new Date(schedule.switch_at), now)
    ) {
      continue;
    }
    const recipient = chooseServiceRecipient(
      await recipientEmails(admin, schedule.organization_id)
    );
    if (!recipient) continue;
    const planId = schedule.plan_id as AnnualPlanId;
    const { subject, html } = priceChangeNoticeEmail({
      planLabel: PLAN_LABEL[planId] || "plan",
      fromPence: schedule.from_amount_pence,
      toPence: schedule.to_amount_pence,
      renewsOn: new Date(schedule.switch_at),
    });
    const status = await deliverIdempotentServiceEmail(logBook, sendEmail, {
      claim: {
        idempotencyKey: priceChangeNoticeKey(schedule.stripe_schedule_id),
        eventKind: "price_change_30d",
        stripeSubscriptionId: schedule.stripe_subscription_id,
        recipientEmail: recipient.to,
      },
      allowed: recipient.allowed,
      subject,
      html,
    });
    counts[status] += 1;
  }

  return NextResponse.json(counts);
}

/** The price on this subscription, not the latest catalogue price. */
async function subscriptionChargePence(subscriptionId: string): Promise<number | null> {
  if (!isStripeTestMode()) return null;
  try {
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    return unitAmountPence(subscription.items?.data?.[0]?.price?.unit_amount);
  } catch (err) {
    log.error("Trial reminder price lookup failed", { err, subscriptionId });
    return null;
  }
}
