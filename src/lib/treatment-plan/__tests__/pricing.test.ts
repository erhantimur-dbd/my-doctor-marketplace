import { describe, expect, it } from "vitest";
import {
  nextTreatmentPlanStatusAfterSession,
  statusForTreatmentPlanProgress,
  treatmentPlanPerVisitAmountCents,
} from "@/lib/treatment-plan/pricing";

describe("treatmentPlanPerVisitAmountCents", () => {
  it("splits discounted_total across sessions", () => {
    expect(
      treatmentPlanPerVisitAmountCents({
        unit_price_cents: 10000,
        discounted_total_cents: 40000,
        total_sessions: 5,
      })
    ).toBe(8000);
  });

  it("falls back to unit price when no discount total", () => {
    expect(
      treatmentPlanPerVisitAmountCents({
        unit_price_cents: 9500,
        discounted_total_cents: null,
        total_sessions: 4,
      })
    ).toBe(9500);
  });
});

describe("statusForTreatmentPlanProgress", () => {
  it("moves sent → accepted with zero sessions", () => {
    expect(
      statusForTreatmentPlanProgress({
        previousStatus: "sent",
        sessionsCompleted: 0,
        totalSessions: 5,
      })
    ).toBe("accepted");
  });

  it("moves to in_progress then completed", () => {
    expect(
      statusForTreatmentPlanProgress({
        previousStatus: "accepted",
        sessionsCompleted: 1,
        totalSessions: 3,
      })
    ).toBe("in_progress");
    expect(
      statusForTreatmentPlanProgress({
        previousStatus: "in_progress",
        sessionsCompleted: 3,
        totalSessions: 3,
      })
    ).toBe("completed");
  });

  it("preserves cancelled/expired", () => {
    expect(
      statusForTreatmentPlanProgress({
        previousStatus: "cancelled",
        sessionsCompleted: 2,
        totalSessions: 5,
      })
    ).toBe("cancelled");
  });
});

describe("nextTreatmentPlanStatusAfterSession", () => {
  it("increments and flips status", () => {
    expect(
      nextTreatmentPlanStatusAfterSession({
        status: "accepted",
        sessions_completed: 0,
        total_sessions: 2,
      })
    ).toEqual({ sessions_completed: 1, status: "in_progress" });

    expect(
      nextTreatmentPlanStatusAfterSession({
        status: "in_progress",
        sessions_completed: 1,
        total_sessions: 2,
      })
    ).toEqual({ sessions_completed: 2, status: "completed" });
  });
});
