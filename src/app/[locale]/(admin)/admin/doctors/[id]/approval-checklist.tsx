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
} from "lucide-react";

interface ApprovalChecklistProps {
  doctorId: string;
  gmcNumber: string | null;
  website: string | null;
  initialData: {
    gmc_verified: boolean;
    website_verified: boolean;
    notes: string | null;
  } | null;
  onChecklistChange: (complete: boolean) => void;
}

export function ApprovalChecklist({
  doctorId,
  gmcNumber,
  website,
  initialData,
  onChecklistChange,
}: ApprovalChecklistProps) {
  const [gmcVerified, setGmcVerified] = useState(
    initialData?.gmc_verified ?? false
  );
  const [websiteVerified, setWebsiteVerified] = useState(
    initialData?.website_verified ?? false
  );
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const checksComplete =
    (gmcVerified ? 1 : 0) + (websiteVerified ? 1 : 0);
  const allComplete = gmcVerified && websiteVerified;

  const save = useCallback(
    async (gmc: boolean, web: boolean, notesVal: string) => {
      setSaving(true);
      const result = await saveApprovalChecklist(doctorId, {
        gmc_verified: gmc,
        website_verified: web,
        notes: notesVal || undefined,
      });

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Checklist saved");
        onChecklistChange(gmc && web);
      }
      setSaving(false);
    },
    [doctorId, onChecklistChange]
  );

  function handleGmcChange(checked: boolean) {
    setGmcVerified(checked);
    save(checked, websiteVerified, notes);
  }

  function handleWebsiteChange(checked: boolean) {
    setWebsiteVerified(checked);
    save(gmcVerified, checked, notes);
  }

  function handleNotesSave() {
    save(gmcVerified, websiteVerified, notes);
  }

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
              {checksComplete} of 2 checks complete
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
            href="https://www.gmc-uk.org/registration-and-licensing/the-medical-register"
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
