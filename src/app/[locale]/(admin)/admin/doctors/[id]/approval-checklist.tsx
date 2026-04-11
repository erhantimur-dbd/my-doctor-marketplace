"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { saveApprovalChecklist } from "@/actions/admin";
import {
  ClipboardCheck,
  ExternalLink,
  Globe,
  CheckCircle,
  Loader2,
  Shield,
} from "lucide-react";
import type {
  ChecklistSnapshot,
  UkRegulatorySnapshot,
} from "./approval-section";
import { isChecklistComplete } from "./approval-section";
import { buildGmcRegisterLink } from "@/lib/verification/gmc";
import { buildCqcSearchLink } from "@/lib/verification/cqc";

interface ApprovalChecklistProps {
  doctorId: string;
  gmcNumber: string | null;
  website: string | null;
  initialData: ChecklistSnapshot | null;
  isUkDoctor: boolean;
  ukRegulatory: UkRegulatorySnapshot;
  onChecklistChange: (complete: boolean) => void;
}

type UkChecklistState = {
  cqcStatusEvidenced: boolean;
  mplAttestationReviewed: boolean;
  excludedProceduresAttestationConfirmed: boolean;
  indemnityDocumentVerified: boolean;
  indemnityInDate: boolean;
  dbsCheckVerified: boolean;
};

export function ApprovalChecklist({
  doctorId,
  gmcNumber,
  website,
  initialData,
  isUkDoctor,
  ukRegulatory,
  onChecklistChange,
}: ApprovalChecklistProps) {
  const [gmcVerified, setGmcVerified] = useState(
    initialData?.gmc_verified ?? false
  );
  const [websiteVerified, setWebsiteVerified] = useState(
    initialData?.website_verified ?? false
  );
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [uk, setUk] = useState<UkChecklistState>({
    cqcStatusEvidenced: initialData?.cqc_status_evidenced ?? false,
    mplAttestationReviewed: initialData?.mpl_attestation_reviewed ?? false,
    excludedProceduresAttestationConfirmed:
      initialData?.excluded_procedures_attestation_confirmed ?? false,
    indemnityDocumentVerified:
      initialData?.indemnity_document_verified ?? false,
    indemnityInDate: initialData?.indemnity_in_date ?? false,
    dbsCheckVerified: initialData?.dbs_check_verified ?? false,
  });
  const [saving, setSaving] = useState(false);

  const totalBoxes = isUkDoctor ? 8 : 2;
  const checksComplete =
    (gmcVerified ? 1 : 0) +
    (websiteVerified ? 1 : 0) +
    (isUkDoctor
      ? (uk.cqcStatusEvidenced ? 1 : 0) +
        (uk.mplAttestationReviewed ? 1 : 0) +
        (uk.excludedProceduresAttestationConfirmed ? 1 : 0) +
        (uk.indemnityDocumentVerified ? 1 : 0) +
        (uk.indemnityInDate ? 1 : 0) +
        (uk.dbsCheckVerified ? 1 : 0)
      : 0);

  const allComplete = isChecklistComplete(
    {
      gmc_verified: gmcVerified,
      website_verified: websiteVerified,
      notes,
      cqc_status_evidenced: uk.cqcStatusEvidenced,
      mpl_attestation_reviewed: uk.mplAttestationReviewed,
      excluded_procedures_attestation_confirmed:
        uk.excludedProceduresAttestationConfirmed,
      indemnity_document_verified: uk.indemnityDocumentVerified,
      indemnity_in_date: uk.indemnityInDate,
      dbs_check_verified: uk.dbsCheckVerified,
    },
    isUkDoctor
  );

  const save = useCallback(
    async (
      gmc: boolean,
      web: boolean,
      notesVal: string,
      ukVal: UkChecklistState
    ) => {
      setSaving(true);
      const result = await saveApprovalChecklist(doctorId, {
        gmc_verified: gmc,
        website_verified: web,
        notes: notesVal || undefined,
        cqc_status_evidenced: ukVal.cqcStatusEvidenced,
        mpl_attestation_reviewed: ukVal.mplAttestationReviewed,
        excluded_procedures_attestation_confirmed:
          ukVal.excludedProceduresAttestationConfirmed,
        indemnity_document_verified: ukVal.indemnityDocumentVerified,
        indemnity_in_date: ukVal.indemnityInDate,
        dbs_check_verified: ukVal.dbsCheckVerified,
      });

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Checklist saved");
        onChecklistChange(
          isChecklistComplete(
            {
              gmc_verified: gmc,
              website_verified: web,
              notes: notesVal,
              cqc_status_evidenced: ukVal.cqcStatusEvidenced,
              mpl_attestation_reviewed: ukVal.mplAttestationReviewed,
              excluded_procedures_attestation_confirmed:
                ukVal.excludedProceduresAttestationConfirmed,
              indemnity_document_verified: ukVal.indemnityDocumentVerified,
              indemnity_in_date: ukVal.indemnityInDate,
              dbs_check_verified: ukVal.dbsCheckVerified,
            },
            isUkDoctor
          )
        );
      }
      setSaving(false);
    },
    [doctorId, onChecklistChange, isUkDoctor]
  );

  function handleGmcChange(checked: boolean) {
    setGmcVerified(checked);
    save(checked, websiteVerified, notes, uk);
  }

  function handleWebsiteChange(checked: boolean) {
    setWebsiteVerified(checked);
    save(gmcVerified, checked, notes, uk);
  }

  function handleUkChange(key: keyof UkChecklistState, checked: boolean) {
    const next = { ...uk, [key]: checked };
    setUk(next);
    save(gmcVerified, websiteVerified, notes, next);
  }

  function handleNotesSave() {
    save(gmcVerified, websiteVerified, notes, uk);
  }

  const cqcLookupLink = ukRegulatory.cqcProviderId
    ? `https://www.cqc.org.uk/search/services?q=${encodeURIComponent(
        ukRegulatory.cqcProviderId
      )}`
    : buildCqcSearchLink(ukRegulatory.indemnityInsurer ?? "");

  const indemnityExpiryDate = ukRegulatory.indemnityExpiry
    ? new Date(ukRegulatory.indemnityExpiry)
    : null;
  const indemnityDaysUntilExpiry = indemnityExpiryDate
    ? Math.ceil(
        (indemnityExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;
  const indemnityInDate =
    indemnityDaysUntilExpiry !== null && indemnityDaysUntilExpiry > 30;

  return (
    <Card className="border-orange-200 bg-orange-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-orange-600" />
            Approval Checklist
          </CardTitle>
          {allComplete ? (
            <Badge className="gap-1 bg-green-600">
              <CheckCircle className="h-3 w-3" />
              All checks complete
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              {checksComplete} of {totalBoxes} checks complete
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* GMC Register Check */}
        <div className="flex items-start gap-3 rounded-lg border bg-background p-4">
          <Checkbox
            id="gmc-check"
            checked={gmcVerified}
            onCheckedChange={(checked) =>
              handleGmcChange(checked === true)
            }
            disabled={saving}
          />
          <div className="flex-1 space-y-1">
            <Label
              htmlFor="gmc-check"
              className="cursor-pointer text-sm font-medium leading-none"
            >
              GMC Register Verified
            </Label>
            <p className="text-sm text-muted-foreground">
              Checked the doctor&apos;s GMC number{" "}
              {gmcNumber && (
                <span className="font-mono font-medium">({gmcNumber})</span>
              )}{" "}
              on the official GMC register
            </p>
          </div>
          <a
            href={buildGmcRegisterLink(gmcNumber)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="gap-1" type="button">
              <ExternalLink className="h-3.5 w-3.5" />
              GMC Register
            </Button>
          </a>
        </div>

        {/* Website Check */}
        <div className="flex items-start gap-3 rounded-lg border bg-background p-4">
          <Checkbox
            id="website-check"
            checked={websiteVerified}
            onCheckedChange={(checked) =>
              handleWebsiteChange(checked === true)
            }
            disabled={saving}
          />
          <div className="flex-1 space-y-1">
            <Label
              htmlFor="website-check"
              className="cursor-pointer text-sm font-medium leading-none"
            >
              Website Verified
            </Label>
            <p className="text-sm text-muted-foreground">
              Verified the doctor&apos;s current website or practice listing
            </p>
          </div>
          {website ? (
            <a
              href={
                website.startsWith("http") ? website : `https://${website}`
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="gap-1" type="button">
                <Globe className="h-3.5 w-3.5" />
                Visit Site
              </Button>
            </a>
          ) : (
            <Badge variant="outline" className="text-xs">
              No website provided
            </Badge>
          )}
        </div>

        {/* UK-conditional checks — only rendered for GB-practising doctors */}
        {isUkDoctor && (
          <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-900 dark:bg-blue-950/20">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold">
                UK Regulatory Checks
              </span>
              <Badge variant="outline" className="text-[10px]">
                Required for mydoctors360.co.uk
              </Badge>
            </div>

            {/* CQC status */}
            <div className="flex items-start gap-3 rounded-lg border bg-background p-3">
              <Checkbox
                id="cqc-check"
                checked={uk.cqcStatusEvidenced}
                onCheckedChange={(checked) =>
                  handleUkChange("cqcStatusEvidenced", checked === true)
                }
                disabled={saving}
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="cqc-check"
                  className="cursor-pointer text-sm font-medium leading-none"
                >
                  CQC Status Evidenced
                </Label>
                <p className="text-xs text-muted-foreground">
                  Doctor declared:{" "}
                  <span className="font-medium">
                    {ukRegulatory.cqcStatus
                      ? ukRegulatory.cqcStatus.replaceAll("_", " ")
                      : "not supplied"}
                  </span>
                  {ukRegulatory.cqcProviderId && (
                    <>
                      {" · Provider "}
                      <span className="font-mono">
                        {ukRegulatory.cqcProviderId}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <a href={cqcLookupLink} target="_blank" rel="noopener noreferrer">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  type="button"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  CQC Search
                </Button>
              </a>
            </div>

            {/* MPL attestation */}
            <div className="flex items-start gap-3 rounded-lg border bg-background p-3">
              <Checkbox
                id="mpl-check"
                checked={uk.mplAttestationReviewed}
                onCheckedChange={(checked) =>
                  handleUkChange("mplAttestationReviewed", checked === true)
                }
                disabled={saving}
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="mpl-check"
                  className="cursor-pointer text-sm font-medium leading-none"
                >
                  MPL Attestation Reviewed
                </Label>
                <p className="text-xs text-muted-foreground">
                  {ukRegulatory.cqcStatus === "exempt_mpl"
                    ? `Designated body: ${
                        ukRegulatory.mplDesignatedBody ?? "not supplied"
                      }`
                    : "Not applicable — doctor did not claim MPL exemption. Tick to acknowledge."}
                </p>
              </div>
            </div>

            {/* Excluded procedures attestation */}
            <div className="flex items-start gap-3 rounded-lg border bg-background p-3">
              <Checkbox
                id="excluded-proc-check"
                checked={uk.excludedProceduresAttestationConfirmed}
                onCheckedChange={(checked) =>
                  handleUkChange(
                    "excludedProceduresAttestationConfirmed",
                    checked === true
                  )
                }
                disabled={saving}
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="excluded-proc-check"
                  className="cursor-pointer text-sm font-medium leading-none"
                >
                  Schedule 2 Excluded Procedures Attestation Confirmed
                </Label>
                <p className="text-xs text-muted-foreground">
                  Doctor attested:{" "}
                  <span className="font-medium">
                    {ukRegulatory.excludedProceduresAttestation
                      ? "Yes, not providing excluded procedures"
                      : "NO — attestation not signed"}
                  </span>
                </p>
              </div>
            </div>

            {/* Indemnity document verified */}
            <div className="flex items-start gap-3 rounded-lg border bg-background p-3">
              <Checkbox
                id="indemnity-doc-check"
                checked={uk.indemnityDocumentVerified}
                onCheckedChange={(checked) =>
                  handleUkChange("indemnityDocumentVerified", checked === true)
                }
                disabled={saving}
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="indemnity-doc-check"
                  className="cursor-pointer text-sm font-medium leading-none"
                >
                  Indemnity Document Verified
                </Label>
                <p className="text-xs text-muted-foreground">
                  Insurer:{" "}
                  <span className="font-medium">
                    {ukRegulatory.indemnityInsurer ?? "not supplied"}
                  </span>
                  {ukRegulatory.indemnityCoverGbp && (
                    <>
                      {" · Cover £"}
                      {ukRegulatory.indemnityCoverGbp.toLocaleString("en-GB")}
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Indemnity in date */}
            <div className="flex items-start gap-3 rounded-lg border bg-background p-3">
              <Checkbox
                id="indemnity-date-check"
                checked={uk.indemnityInDate}
                onCheckedChange={(checked) =>
                  handleUkChange("indemnityInDate", checked === true)
                }
                disabled={saving}
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="indemnity-date-check"
                  className="cursor-pointer text-sm font-medium leading-none"
                >
                  Indemnity In Date (&gt;30 days)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Expires:{" "}
                  <span
                    className={
                      indemnityInDate
                        ? "font-medium"
                        : "font-medium text-orange-600"
                    }
                  >
                    {ukRegulatory.indemnityExpiry ?? "not supplied"}
                    {indemnityDaysUntilExpiry !== null && (
                      <> ({indemnityDaysUntilExpiry} days)</>
                    )}
                  </span>
                </p>
              </div>
            </div>

            {/* DBS check */}
            <div className="flex items-start gap-3 rounded-lg border bg-background p-3">
              <Checkbox
                id="dbs-check"
                checked={uk.dbsCheckVerified}
                onCheckedChange={(checked) =>
                  handleUkChange("dbsCheckVerified", checked === true)
                }
                disabled={saving}
                className="mt-0.5"
              />
              <div className="flex-1 space-y-1">
                <Label
                  htmlFor="dbs-check"
                  className="cursor-pointer text-sm font-medium leading-none"
                >
                  DBS Check Verified (or N/A)
                </Label>
                <p className="text-xs text-muted-foreground">
                  DBS issue date:{" "}
                  <span className="font-medium">
                    {ukRegulatory.dbsCheckDate ?? "not supplied"}
                  </span>
                  . Tick if verified or if patient population does not require
                  DBS.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="approval-notes" className="text-sm font-medium">
            Notes (optional)
          </Label>
          <Textarea
            id="approval-notes"
            placeholder="Add any additional observations or notes about this verification..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleNotesSave}
              disabled={saving}
              type="button"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Notes
            </Button>
          </div>
        </div>

        {allComplete && (
          <p className="text-sm text-green-700">
            All checks are complete. You can now verify this doctor using the
            actions below.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
