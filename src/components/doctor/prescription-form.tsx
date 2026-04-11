"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ScrollText, Loader2, AlertTriangle } from "lucide-react";
import {
  createPrescription,
  type MedicationInput,
} from "@/actions/prescriptions";

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

interface PrescriptionFormProps {
  patients: Patient[];
}

const emptyMedication: MedicationInput = {
  name: "",
  dosage: "",
  frequency: "",
  duration: "",
  instructions: "",
};

const CONTROLLED_DRUG_JUSTIFICATION_MIN = 40;

export function PrescriptionForm({ patients }: PrescriptionFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [patientId, setPatientId] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [medications, setMedications] = useState<MedicationInput[]>([
    { ...emptyMedication },
  ]);

  // Workstream 3.1 — doctor attestations at issue time.
  const [attestedClinicalAssessment, setAttestedClinicalAssessment] =
    useState(false);
  const [attestedRemotePrescribing, setAttestedRemotePrescribing] =
    useState(false);
  const [containsControlledDrug, setContainsControlledDrug] = useState(false);
  const [controlledDrugJustification, setControlledDrugJustification] =
    useState("");
  // Two-step confirmation gate for controlled drugs: ticking the CD
  // checkbox opens a blocking dialog that the doctor must acknowledge
  // before the form can be submitted.
  const [cdAcknowledged, setCdAcknowledged] = useState(false);

  function addMedication() {
    setMedications((prev) => [...prev, { ...emptyMedication }]);
  }

  function removeMedication(index: number) {
    setMedications((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMedication(
    index: number,
    field: keyof MedicationInput,
    value: string
  ) {
    setMedications((prev) =>
      prev.map((med, i) => (i === index ? { ...med, [field]: value } : med))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) {
      setError("Please select a patient");
      return;
    }
    if (medications.length === 0 || !medications[0].name) {
      setError("Please add at least one medication");
      return;
    }
    if (!attestedClinicalAssessment) {
      setError(
        "You must confirm you have conducted an adequate clinical assessment."
      );
      return;
    }
    if (!attestedRemotePrescribing) {
      setError(
        "You must confirm you have considered whether remote prescribing is appropriate (GMC guidance)."
      );
      return;
    }
    if (containsControlledDrug) {
      if (!cdAcknowledged) {
        setError(
          "Please acknowledge the controlled drug warning before issuing this prescription."
        );
        return;
      }
      if (
        controlledDrugJustification.trim().length <
        CONTROLLED_DRUG_JUSTIFICATION_MIN
      ) {
        setError(
          `Controlled drug justification must be at least ${CONTROLLED_DRUG_JUSTIFICATION_MIN} characters and explain why remote prescribing is appropriate in this case.`
        );
        return;
      }
    }

    setLoading(true);
    setError("");

    const result = await createPrescription({
      patient_id: patientId,
      diagnosis: diagnosis || null,
      medications: medications.filter((m) => m.name.trim()),
      notes: notes || null,
      valid_until: validUntil || null,
      contains_controlled_drug: containsControlledDrug,
      controlled_drug_justification: containsControlledDrug
        ? controlledDrugJustification.trim()
        : null,
      attestation: {
        clinical_assessment: true,
        remote_prescribing_considered: true,
      },
    });

    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    router.push("/doctor-dashboard/prescriptions");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Patient Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Patient Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="patient">Patient *</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger id="patient">
                <SelectValue placeholder="Select a patient" />
              </SelectTrigger>
              <SelectContent>
                {patients.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.first_name} {p.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="diagnosis">Diagnosis</Label>
            <Textarea
              id="diagnosis"
              placeholder="Enter diagnosis..."
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Medications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Medications *</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addMedication}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Medication
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {medications.map((med, i) => (
            <div
              key={i}
              className="relative rounded-lg border p-4 space-y-3"
            >
              {medications.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2 h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeMedication(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Medication Name *</Label>
                  <Input
                    placeholder="e.g. Amoxicillin"
                    value={med.name}
                    onChange={(e) => updateMedication(i, "name", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label>Dosage</Label>
                  <Input
                    placeholder="e.g. 500mg"
                    value={med.dosage || ""}
                    onChange={(e) =>
                      updateMedication(i, "dosage", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Frequency</Label>
                  <Input
                    placeholder="e.g. 3 times daily"
                    value={med.frequency || ""}
                    onChange={(e) =>
                      updateMedication(i, "frequency", e.target.value)
                    }
                  />
                </div>
                <div>
                  <Label>Duration</Label>
                  <Input
                    placeholder="e.g. 7 days"
                    value={med.duration || ""}
                    onChange={(e) =>
                      updateMedication(i, "duration", e.target.value)
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Instructions</Label>
                <Input
                  placeholder="e.g. Take with food"
                  value={med.instructions || ""}
                  onChange={(e) =>
                    updateMedication(i, "instructions", e.target.value)
                  }
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Additional info */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="validUntil">Valid Until</Label>
            <Input
              id="validUntil"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes or instructions..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Doctor attestations — required by GMC remote prescribing guidance.
          Part of Workstream 3.1 of the UK CQC compliance plan. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Prescriber attestation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="att-clinical-assessment"
              checked={attestedClinicalAssessment}
              onCheckedChange={(checked) =>
                setAttestedClinicalAssessment(checked === true)
              }
            />
            <Label
              htmlFor="att-clinical-assessment"
              className="text-sm font-normal leading-snug"
            >
              I confirm I have conducted an adequate clinical assessment of
              this patient sufficient to issue this prescription safely.
            </Label>
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="att-remote-prescribing"
              checked={attestedRemotePrescribing}
              onCheckedChange={(checked) =>
                setAttestedRemotePrescribing(checked === true)
              }
            />
            <Label
              htmlFor="att-remote-prescribing"
              className="text-sm font-normal leading-snug"
            >
              I confirm I have considered whether remote prescribing is
              appropriate in this case, in line with GMC guidance.
            </Label>
          </div>

          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
            <div className="flex items-start gap-3">
              <Checkbox
                id="att-controlled-drug"
                checked={containsControlledDrug}
                onCheckedChange={(checked) => {
                  const next = checked === true;
                  setContainsControlledDrug(next);
                  if (!next) {
                    setCdAcknowledged(false);
                    setControlledDrugJustification("");
                  }
                }}
              />
              <div className="space-y-2">
                <Label
                  htmlFor="att-controlled-drug"
                  className="font-medium leading-snug text-amber-900 dark:text-amber-200"
                >
                  This prescription contains a Schedule 2, 3, 4, or 5
                  controlled drug.
                </Label>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  Leave unchecked for ordinary (non-controlled) prescriptions.
                  Tick only if a controlled drug is included — a clinical
                  justification will be required below and the issue will be
                  recorded in the prescribing audit log.
                </p>
              </div>
            </div>

            {containsControlledDrug && (
              <div className="mt-4 space-y-3 border-t border-amber-300 pt-3 dark:border-amber-800">
                <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <p className="text-xs">
                    GMC guidance <em>strongly discourages</em> remote
                    prescribing of controlled drugs. You must be able to show
                    why this remote prescription is clinically safe and
                    justified. This attestation and the justification below
                    will be stored immutably in the prescribing audit log.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="att-cd-acknowledge"
                    checked={cdAcknowledged}
                    onCheckedChange={(checked) =>
                      setCdAcknowledged(checked === true)
                    }
                  />
                  <Label
                    htmlFor="att-cd-acknowledge"
                    className="text-xs font-normal leading-snug text-amber-900 dark:text-amber-200"
                  >
                    I acknowledge the above and confirm I have exceptional
                    clinical grounds for issuing this controlled drug
                    remotely.
                  </Label>
                </div>
                <div>
                  <Label
                    htmlFor="cd-justification"
                    className="text-xs text-amber-900 dark:text-amber-200"
                  >
                    Clinical justification (min{" "}
                    {CONTROLLED_DRUG_JUSTIFICATION_MIN} characters)
                  </Label>
                  <Textarea
                    id="cd-justification"
                    rows={3}
                    placeholder="e.g. Established patient with chronic condition, previously stabilised face-to-face, continuation of existing regime…"
                    value={controlledDrugJustification}
                    onChange={(e) =>
                      setControlledDrugJustification(e.target.value)
                    }
                    className="mt-1 bg-white dark:bg-zinc-900"
                  />
                  <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                    {controlledDrugJustification.trim().length} /
                    {" "}
                    {CONTROLLED_DRUG_JUSTIFICATION_MIN} characters
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex gap-3">
        <Button type="submit" disabled={loading} className="gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ScrollText className="h-4 w-4" />
          )}
          {loading ? "Creating..." : "Create Prescription"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
