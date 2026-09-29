/**
 * Per-visit charge for a care plan session.
 *
 * Package discounts are stored on discounted_total_cents. Patients must be
 * charged the discounted per-session amount, not the pre-discount unit price.
 */
export function treatmentPlanPerVisitAmountCents(plan: {
  unit_price_cents: number;
  discounted_total_cents?: number | null;
  total_sessions: number;
}): number {
  const sessions = Math.max(1, Number(plan.total_sessions) || 1);
  const discounted = plan.discounted_total_cents;

  if (
    typeof discounted === "number" &&
    Number.isFinite(discounted) &&
    discounted > 0
  ) {
    return Math.max(1, Math.round(discounted / sessions));
  }

  return Math.max(0, Number(plan.unit_price_cents) || 0);
}

/**
 * Status after paying/booking sessions. Pure helper for actions + webhook.
 */
export function statusForTreatmentPlanProgress(input: {
  previousStatus: string;
  sessionsCompleted: number;
  totalSessions: number;
}): string {
  const { previousStatus, sessionsCompleted, totalSessions } = input;

  if (previousStatus === "cancelled" || previousStatus === "expired") {
    return previousStatus;
  }

  if (sessionsCompleted >= totalSessions && totalSessions > 0) {
    return "completed";
  }

  if (sessionsCompleted > 0) {
    return "in_progress";
  }

  // Accepted (or still sent until accept path flips it) with no sessions yet.
  if (previousStatus === "sent") {
    return "accepted";
  }

  return previousStatus === "in_progress" || previousStatus === "completed"
    ? previousStatus
    : "accepted";
}

/**
 * Next plan status after booking/confirming one additional session
 * (optimistic increment from current sessions_completed).
 */
export function nextTreatmentPlanStatusAfterSession(plan: {
  status: string;
  sessions_completed: number;
  total_sessions: number;
}): { sessions_completed: number; status: string } {
  const sessionsCompleted = plan.sessions_completed + 1;
  return {
    sessions_completed: sessionsCompleted,
    status: statusForTreatmentPlanProgress({
      previousStatus: plan.status,
      sessionsCompleted,
      totalSessions: plan.total_sessions,
    }),
  };
}
