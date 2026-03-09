"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApprovalChecklist } from "./approval-checklist";
import { AdminDoctorActions } from "./actions-client";

interface ApprovalSectionProps {
  doctorId: string;
  gmcNumber: string | null;
  website: string | null;
  verificationStatus: string;
  isActive: boolean;
  isFeatured: boolean;
  currentPlan: string;
  checklist: {
    gmc_verified: boolean;
    website_verified: boolean;
    notes: string | null;
  } | null;
}

/**
 * Client wrapper that coordinates ApprovalChecklist and AdminDoctorActions.
 * When a checklist item is toggled, the verify button enables/disables immediately.
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
}: ApprovalSectionProps) {
  const isPendingOrReview =
    verificationStatus === "pending" || verificationStatus === "under_review";

  const [checklistComplete, setChecklistComplete] = useState(
    checklist?.gmc_verified === true && checklist?.website_verified === true
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
