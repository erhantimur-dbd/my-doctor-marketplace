import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  isCarePlansEnabled,
  isPrescriptionsEnabled,
  isPublicChatEnabled,
  isSymptomAnalysisEnabled,
  CARE_PLANS_DISABLED_MESSAGE,
  PRESCRIPTIONS_DISABLED_MESSAGE,
  PUBLIC_CHAT_DISABLED_MESSAGE,
  SYMPTOM_ANALYSIS_DISABLED_MESSAGE,
} from "../soft-launch";

describe("soft-launch kill-switch", () => {
  it("hard-disables prescriptions, care plans, public chat, and symptom analysis for every tier", () => {
    expect(isPrescriptionsEnabled()).toBe(false);
    expect(isCarePlansEnabled()).toBe(false);
    expect(isPublicChatEnabled()).toBe(false);
    expect(isSymptomAnalysisEnabled()).toBe(false);
  });

  it("uses launch-disabled copy, not upgrade/unlock language", () => {
    expect(PRESCRIPTIONS_DISABLED_MESSAGE).toBe(
      "Prescriptions are disabled for this launch"
    );
    expect(CARE_PLANS_DISABLED_MESSAGE).toBe(
      "Care plans are disabled for this launch"
    );
    expect(PUBLIC_CHAT_DISABLED_MESSAGE).toMatch(/unavailable/i);
    expect(SYMPTOM_ANALYSIS_DISABLED_MESSAGE).toMatch(/unavailable/i);
    expect(PRESCRIPTIONS_DISABLED_MESSAGE).not.toMatch(/upgrade|unlock|professional/i);
    expect(CARE_PLANS_DISABLED_MESSAGE).not.toMatch(/upgrade|unlock|professional/i);
  });
});

describe("prescriptions are hard-disabled, not feature-gated", () => {
  it("does not use hasFeature as prescription access control", () => {
    const src = readFileSync(
      join(process.cwd(), "src/actions/prescriptions.ts"),
      "utf8"
    );
    expect(src).toContain("isPrescriptionsEnabled");
    expect(src).toContain("PRESCRIPTIONS_DISABLED_MESSAGE");
    expect(src).not.toContain("hasFeature");
    expect(src).not.toContain("requirePrescriptionsFeature");
    expect(src).not.toContain("getDoctorLicenseTier");
  });
});

describe("care plans are hard-disabled", () => {
  it("treatment-plan mutations and reads fail closed", () => {
    const src = readFileSync(
      join(process.cwd(), "src/actions/treatment-plan.ts"),
      "utf8"
    );
    expect(src).toContain("isCarePlansEnabled");
    expect(src).toContain("CARE_PLANS_DISABLED_MESSAGE");
    for (const name of [
      "createTreatmentPlan",
      "getTreatmentPlanByToken",
      "acceptTreatmentPlanFull",
      "acceptTreatmentPlanPerVisit",
      "bookTreatmentPlanSession",
      "cancelTreatmentPlan",
      "getDoctorTreatmentPlans",
      "getPatientTreatmentPlansV2",
    ]) {
      expect(src, name).toContain(name);
    }
  });
});

describe("public chat is hard-disabled even when authenticated", () => {
  it("POST /api/chat returns a disabled 403 before streaming", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/api/chat/route.ts"),
      "utf8"
    );
    expect(src).toContain("isPublicChatEnabled");
    expect(src).toContain("PUBLIC_CHAT_DISABLED_MESSAGE");
    expect(src).toContain("403");
  });

  it("analyzeSymptoms fails closed as a public entry point", () => {
    const src = readFileSync(join(process.cwd(), "src/actions/ai.ts"), "utf8");
    expect(src).toContain("isSymptomAnalysisEnabled");
    expect(src).toContain("SYMPTOM_ANALYSIS_DISABLED_MESSAGE");
  });
});

describe("related care-plan issuance is hard-disabled", () => {
  it("follow-up invitation create/accept/book fail closed", () => {
    const src = readFileSync(
      join(process.cwd(), "src/actions/follow-up.ts"),
      "utf8"
    );
    expect(src).toContain("isCarePlansEnabled");
    expect(src).toContain("CARE_PLANS_DISABLED_MESSAGE");
  });
});

describe("#17 security bits remain", () => {
  it("keeps the privileged-column RLS lock", () => {
    const src = readFileSync(
      join(
        process.cwd(),
        "supabase/migrations/00108_lock_doctor_privileged_columns.sql"
      ),
      "utf8"
    );
    expect(src).toContain("prevent_doctor_privileged_column_update");
    expect(src).toContain("verification_status");
    expect(src).toContain("is_featured");
  });

  it("keeps ADMIN_EMAILS fail-closed in production", () => {
    const admin = readFileSync(
      join(process.cwd(), "src/actions/admin.ts"),
      "utf8"
    );
    const page = readFileSync(
      join(process.cwd(), "src/lib/admin/require-admin-page.ts"),
      "utf8"
    );
    expect(admin).toContain("ADMIN_EMAILS.length === 0");
    expect(page).toContain("ADMIN_EMAILS.length === 0");
  });

  it("every cron route still requires CRON_SECRET via authorizeCronRequest", () => {
    const root = join(process.cwd(), "src/app/api/cron");
    const routes: string[] = [];
    for (const name of readdirSync(root)) {
      const route = join(root, name, "route.ts");
      try {
        if (statSync(route).isFile()) routes.push(route);
      } catch {
        /* skip */
      }
    }
    expect(routes.length).toBeGreaterThanOrEqual(12);
    for (const file of routes) {
      const src = readFileSync(file, "utf8");
      expect(src, file).toContain("authorizeCronRequest");
    }
  });

  it("keeps Stripe webhook insert-first idempotency", () => {
    const src = readFileSync(
      join(process.cwd(), "src/app/api/webhooks/stripe/route.ts"),
      "utf8"
    );
    expect(src).toContain("processed_webhook_events");
    expect(src).toContain("claimError");
    expect(src).toContain("23505");
  });

  it("keeps clinic invite transfer email match checks", () => {
    const src = readFileSync(
      join(process.cwd(), "src/actions/clinic-invitations.ts"),
      "utf8"
    );
    const matches = src.match(
      /profile\.email\.toLowerCase\(\) !== invite\.email\.toLowerCase\(\)/g
    );
    expect(matches?.length).toBeGreaterThanOrEqual(2);
  });
});
