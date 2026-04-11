"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApprovalChecklist } from "./approval-checklist";
import { AdminDoctorActions } from "./actions-client";

export interface UkRegulatorySnapshot {
  practisingCountry: string | null;
  cqcStatus: string | null;
  cqcProviderId: string | null;
  cqcLocationId: string | null;
  mplDesignatedBody: string | null;
  excludedProceduresAttestation: boolean;
  indemnityInsurer: string | null;
  indemnityCoverGbp: number | null;
  indemnityExpiry: string | null;
  dbsCheckDate: string | null;
}

export interface ChecklistSnapshot {
  gmc_verified: boolean;
  website_verified: boolean;
  notes: string | null;
  cqc_status_evidenced?: boolean;
  mpl_attestation_reviewed?: boolean;
  excluded_procedures_attestation_confirmed?: boolean;
  indemnity_document_verified?: boolean;
  indemnity_in_date?: boolean;
  dbs_check_verified?: boolean;
}

interface ApprovalSectionProps {
  doctorId: string;
  gmcNumber: string | null;
  website: string | null;
  verificationStatus: string;
  isActive: boolean;
  isFeatured: boolean;
  currentPlan: string;
  checklist: ChecklistSnapshot | null;
  ukRegulatory: UkRegulatorySnapshot;
}

/**
 * Client wrapper that coordinates ApprovalChecklist and AdminDoctorActions.
 *
 * The "checklist complete" signal drives whether the Verify button is
 * enabled. For UK-practising doctors we require the full UK box set as
 * well — see `isChecklistComplete()` below.
 */
export function ApprovalSection({
  doctorId,
  gmcNumber,
  website,
  verificationStatus,
  isActive,
  isFeatured,
  currentPlan,
  checklist,
  ukRegulatory,
}: ApprovalSectionProps) {
  const isPendingOrReview =
    verificationStatus === "pending" || verificationStatus === "under_review";

  const isUkDoctor = ukRegulatory.practisingCountry === "GB";

  const [checklistComplete, setChecklistComplete] = useState(
    isChecklistComplete(checklist, isUkDoctor)
  );

  return (
    <>
      {/* Only show checklist for pending/under_review doctors */}
      {isPendingOrReview && (
        <ApprovalChecklist
          doctorId={doctorId}
          gmcNumber={gmcNumber}
          website={website}
          initialData={checklist}
          isUkDoctor={isUkDoctor}
          ukRegulatory={ukRegulatory}
          onChecklistChange={setChecklistComplete}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Admin Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminDoctorActions
            doctorId={doctorId}
            currentStatus={verificationStatus}
            isActive={isActive}
            isFeatured={isFeatured}
            currentPlan={currentPlan}
            checklistComplete={isPendingOrReview ? checklistComplete : true}
          />
        </CardContent>
      </Card>
    </>
  );
}

export function isChecklistComplete(
  checklist: ChecklistSnapshot | null,
  isUkDoctor: boolean
): boolean {
  if (!checklist) return false;
  if (!checklist.gmc_verified) return false;
  if (!checklist.website_verified) return false;
  if (!isUkDoctor) return true;
  // UK-practising doctors must clear every UK-conditional box before
  // approval — this mirrors the server-side gate in src/actions/admin.ts.
  return Boolean(
    checklist.cqc_status_evidenced &&
      checklist.mpl_attestation_reviewed &&
      checklist.excluded_procedures_attestation_confirmed &&
      checklist.indemnity_document_verified &&
      checklist.indemnity_in_date &&
      checklist.dbs_check_verified
  );
}
