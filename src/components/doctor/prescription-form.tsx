"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ScrollText, Loader2 } from "lucide-react";
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

    setLoading(true);
    setError("");

    const result = await createPrescription({
      patient_id: patientId,
      diagnosis: diagnosis || null,
      medications: medications.filter((m) => m.name.trim()),
      notes: notes || null,
      valid_until: validUntil || null,
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
