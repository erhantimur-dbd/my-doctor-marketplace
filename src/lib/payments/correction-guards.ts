/**
 * Pure guards for payment corrections.
 * An open dispute pauses the whole correction via assertNoOpenDispute.
 */

export const CLEAR_RISK_REASON_CODES = [
  "account_closing",
  "suspected_fraud",
  "insolvency",
] as const;

export type ClearRiskReasonCode = (typeof CLEAR_RISK_REASON_CODES)[number];

/** Money actions this module can run. There is no card-charge action. */
export const CORRECTION_MONEY_ACTIONS = [
  "transfer_reversal",
  "payout_offset",
  "direct_request",
  "patient_refund",
  "wallet_debit",
  "wallet_credit",
  "doctor_topup",
] as const;

export type CorrectionMoneyAction = (typeof CORRECTION_MONEY_ACTIONS)[number];

const RECOVERY_ACTIONS: ReadonlySet<CorrectionMoneyAction> = new Set([
  "transfer_reversal",
  "payout_offset",
  "direct_request",
  "wallet_debit",
]);

export type ApprovalRecord = {
  approverId: string;
  inAllowlist: boolean;
  director: boolean;
};

export type CorrectionGuardState = {
  party: "patient" | "doctor";
  direction: "customer_favour" | "platform_favour";
  createdBy: string | null;
  requiredApprovals: number;
  approvals: ApprovalRecord[];
  noticeSentAt: string | null;
  earliestRecoveryAt: string | null;
  clearRisk: boolean;
  escalatedByDoctorAt: string | null;
  disputeOpen: boolean;
  disputeOutcome: "customer_wins" | "correction_upheld" | null;
  reversalOutcome: "full" | "short" | "failed" | null;
  offsetUncollectible: boolean;
  patientConsentRecorded: boolean;
  nowIso: string;
};

export class CorrectionGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CorrectionGuardError";
  }
}

export function assertNoOpenDispute(state: { disputeOpen: boolean }): void {
  if (state.disputeOpen) {
    throw new CorrectionGuardError(
      "An open dispute pauses this correction"
    );
  }
}

export function distinctApprovalCount(state: {
  createdBy: string | null;
  approvals: ApprovalRecord[];
}): number {
  const ids = new Set<string>();
  for (const approval of state.approvals) {
    if (!approval.inAllowlist) continue;
    if (state.createdBy && approval.approverId === state.createdBy) continue;
    ids.add(approval.approverId);
  }
  return ids.size;
}

export function hasDirectorApproval(state: {
  createdBy: string | null;
  approvals: ApprovalRecord[];
}): boolean {
  return state.approvals.some(
    (approval) =>
      approval.inAllowlist &&
      approval.director &&
      approval.approverId !== state.createdBy
  );
}

export function approvalsSatisfied(state: {
  createdBy: string | null;
  requiredApprovals: number;
  approvals: ApprovalRecord[];
  escalatedByDoctorAt: string | null;
}): boolean {
  if (distinctApprovalCount(state) < state.requiredApprovals) return false;
  if (state.escalatedByDoctorAt && !hasDirectorApproval(state)) return false;
  return true;
}

/**
 * Dispute and approval gate for an offset.
 * An open dispute uses assertNoOpenDispute: the whole correction pauses.
 * Approvals are distinct named approvers, excluding the creator, plus a
 * director when the doctor has escalated.
 * A fully reserved row still passes: remaining cents were already taken.
 */
export function offsetRecoveryGateOpen(input: {
  disputeOpen: boolean;
  requiredApprovals: number;
  createdBy: string | null;
  approvals: ApprovalRecord[];
  escalatedByDoctorAt: string | null;
}): boolean {
  try {
    assertNoOpenDispute({ disputeOpen: input.disputeOpen });
  } catch {
    return false;
  }
  return approvalsSatisfied(input);
}

/** Whether a doctor offset may be reserved or an existing hold kept. */
export function isCorrectionOffsetEligible(input: {
  recoveryStep: number;
  noticeSentAt: string | null;
  earliestRecoveryAt: string | null;
  clearRisk: boolean;
  disputeOpen: boolean;
  requiredApprovals: number;
  createdBy: string | null;
  approvals: ApprovalRecord[];
  escalatedByDoctorAt: string | null;
  reversalShortOrFailed: boolean;
  nowIso: string;
}): boolean {
  if (!offsetRecoveryGateOpen(input)) return false;
  if (input.recoveryStep < 2 || !input.noticeSentAt) return false;
  if (!input.reversalShortOrFailed) return false;
  if (!input.clearRisk) {
    if (!input.earliestRecoveryAt || input.nowIso < input.earliestRecoveryAt) {
      return false;
    }
  }
  return true;
}

export function isWithinTwelveMonths(
  relatedPaymentAt: Date,
  createdAt: Date
): boolean {
  const limit = new Date(relatedPaymentAt.getTime());
  limit.setUTCMonth(limit.getUTCMonth() + 12);
  return createdAt.getTime() <= limit.getTime();
}

export function assertWithinTwelveMonths(input: {
  errorType: string;
  relatedPaymentAt: Date | null;
  createdAt: Date;
}): void {
  if (input.errorType === "fraud") return;
  if (!input.relatedPaymentAt) {
    throw new CorrectionGuardError("Related payment date is required");
  }
  if (!isWithinTwelveMonths(input.relatedPaymentAt, input.createdAt)) {
    throw new CorrectionGuardError(
      "Corrections must be raised within 12 months of the payment"
    );
  }
}

export function assertCanSetClearRisk(input: {
  party: "patient" | "doctor";
  actorIsApprover: boolean;
  reasonCode: string;
  reason: string;
}): void {
  if (!input.actorIsApprover) {
    throw new CorrectionGuardError("Only a named approver can set clear risk");
  }
  if (input.party !== "doctor") {
    throw new CorrectionGuardError("Clear risk applies to doctor corrections only");
  }
  if (
    !CLEAR_RISK_REASON_CODES.includes(input.reasonCode as ClearRiskReasonCode)
  ) {
    throw new CorrectionGuardError("Clear risk reason code is not allowed");
  }
  if (!input.reason.trim()) {
    throw new CorrectionGuardError("Clear risk needs a written reason");
  }
}

function assertRecoveryWait(state: CorrectionGuardState): void {
  if (!state.noticeSentAt) {
    throw new CorrectionGuardError(
      "Recovery waits until the notice has been sent"
    );
  }
  if (state.clearRisk) return;
  if (!state.earliestRecoveryAt) {
    throw new CorrectionGuardError("Recovery waits 14 days after notice");
  }
  if (Date.parse(state.nowIso) < Date.parse(state.earliestRecoveryAt)) {
    throw new CorrectionGuardError("Recovery waits 14 days after notice");
  }
}

function assertDoctorRecoveryOrder(
  state: CorrectionGuardState,
  action: CorrectionMoneyAction
): void {
  if (action === "transfer_reversal") return;
  if (action === "payout_offset") {
    if (state.reversalOutcome !== "short" && state.reversalOutcome !== "failed") {
      throw new CorrectionGuardError(
        "Offset a future payout only after transfer reversal is short or impossible"
      );
    }
    return;
  }
  if (action === "direct_request") {
    const reversalDone =
      state.reversalOutcome === "short" || state.reversalOutcome === "failed";
    if (!reversalDone || !state.offsetUncollectible) {
      throw new CorrectionGuardError(
        "A direct request follows reversal and an offset that cannot be collected"
      );
    }
  }
}

export function assertMoneyMovement(
  state: CorrectionGuardState,
  action: CorrectionMoneyAction
): void {
  assertNoOpenDispute(state);
  if (!approvalsSatisfied(state)) {
    throw new CorrectionGuardError(
      "Money movement needs the required named approvals"
    );
  }

  if (RECOVERY_ACTIONS.has(action)) {
    assertRecoveryWait(state);
  }

  if (action === "doctor_topup") {
    const doctorWon =
      state.party === "doctor" &&
      state.disputeOutcome === "customer_wins" &&
      !state.disputeOpen;
    if (state.party === "doctor" && state.direction === "customer_favour") return;
    if (doctorWon) return;
    throw new CorrectionGuardError(
      "A doctor top-up is a customer-favour repayment"
    );
  }

  if (state.party === "patient" && state.direction === "platform_favour") {
    if (action === "wallet_debit") {
      if (!state.patientConsentRecorded) {
        throw new CorrectionGuardError(
          "A patient wallet debit needs recorded consent"
        );
      }
      return;
    }
    if (action === "direct_request") return;
    throw new CorrectionGuardError(
      "Patient recovery is a direct request, or a wallet debit after recorded consent"
    );
  }

  if (action === "wallet_debit") {
    throw new CorrectionGuardError(
      "A wallet debit is only for a patient correction with recorded consent"
    );
  }

  if (state.party === "doctor" && state.direction === "platform_favour") {
    if (
      action !== "transfer_reversal" &&
      action !== "payout_offset" &&
      action !== "direct_request"
    ) {
      throw new CorrectionGuardError(
        "Doctor recovery follows reversal, then offset, then a direct request"
      );
    }
    assertDoctorRecoveryOrder(state, action);
    return;
  }

  if (action === "patient_refund") {
    if (state.party !== "patient" || state.direction !== "customer_favour") {
      throw new CorrectionGuardError("Patient refunds are customer-favour corrections");
    }
    return;
  }

  if (action === "wallet_credit") {
    if (state.party !== "patient" || state.direction !== "customer_favour") {
      throw new CorrectionGuardError("Wallet credit is a customer-favour patient correction");
    }
    return;
  }

}

export function assertCanRecreateFounding(input: {
  actorIsApprover: boolean;
  approvalsMet: boolean;
  ourError: boolean;
  party: "patient" | "doctor";
  hasFoundingNumber: boolean;
  disputeOpen: boolean;
}): void {
  assertNoOpenDispute(input);
  if (!input.actorIsApprover || !input.approvalsMet) {
    throw new CorrectionGuardError(
      "Recreating the founding subscription needs a named approver"
    );
  }
  if (!input.ourError || input.party !== "doctor" || !input.hasFoundingNumber) {
    throw new CorrectionGuardError(
      "Only an our-error founding correction for an existing founding doctor can be recreated"
    );
  }
}
