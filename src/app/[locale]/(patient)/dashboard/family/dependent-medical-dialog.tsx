"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Switch } from "@/components/ui/switch";
import { HeartPulse, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  getDependentMedicalProfile,
  updateDependentMedicalProfile,
} from "@/actions/family";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

interface DependentMedicalDialogProps {
  dependentId: string;
  dependentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function DependentMedicalDialog({
  dependentId,
  dependentName,
  open,
  onOpenChange,
  onSaved,
}: DependentMedicalDialogProps) {
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [bloodType, setBloodType] = useState("");
  const [allergies, setAllergies] = useState("");
  const [chronicConditions, setChronicConditions] = useState("");
  const [currentMedications, setCurrentMedications] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [sharingConsent, setSharingConsent] = useState(false);

  // Load data when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);

    getDependentMedicalProfile(dependentId).then((data) => {
      if (data) {
        setBloodType(data.blood_type || "");
        setAllergies((data.allergies || []).join(", "));
        setChronicConditions((data.chronic_conditions || []).join(", "));
        setCurrentMedications((data.current_medications || []).join(", "));
        setEmergencyName(data.emergency_contact_name || "");
        setEmergencyPhone(data.emergency_contact_phone || "");
        setNotes(data.notes || "");
        setSharingConsent(data.sharing_consent || false);
      } else {
        // Reset to empty for new profile
        setBloodType("");
        setAllergies("");
        setChronicConditions("");
        setCurrentMedications("");
        setEmergencyName("");
        setEmergencyPhone("");
        setNotes("");
        setSharingConsent(false);
      }
      setLoading(false);
    });
  }, [open, dependentId]);

  function parseCommaSeparated(value: string): string[] {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function handleSave() {
    startTransition(async () => {
      const result = await updateDependentMedicalProfile(dependentId, {
        blood_type: bloodType || null,
        allergies: parseCommaSeparated(allergies),
        chronic_conditions: parseCommaSeparated(chronicConditions),
        current_medications: parseCommaSeparated(currentMedications),
        emergency_contact_name: emergencyName.trim() || null,
        emergency_contact_phone: emergencyPhone.trim() || null,
        notes: notes.trim() || null,
        sharing_consent: sharingConsent,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Medical profile updated for ${dependentName}`);
      onSaved?.();
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-primary" />
            Medical Profile — {dependentName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              This information helps doctors provide better care for{" "}
              {dependentName}. It is only visible to you and treating physicians.
            </p>

            {/* Blood Type */}
            <div>
              <Label>Blood Type</Label>
              <Select value={bloodType} onValueChange={setBloodType}>
                <SelectTrigger className="mt-1.5 w-full sm:w-48">
                  <SelectValue placeholder="Select blood type" />
                </SelectTrigger>
                <SelectContent>
                  {BLOOD_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Allergies */}
            <div>
              <Label htmlFor="dep-allergies">Allergies</Label>
              <Textarea
                id="dep-allergies"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="e.g., Penicillin, Peanuts, Latex"
                rows={2}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Separate multiple allergies with commas
              </p>
            </div>

            {/* Chronic Conditions */}
            <div>
              <Label htmlFor="dep-conditions">Chronic Conditions</Label>
              <Textarea
                id="dep-conditions"
                value={chronicConditions}
                onChange={(e) => setChronicConditions(e.target.value)}
                placeholder="e.g., Asthma, Diabetes, Eczema"
                rows={2}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Separate multiple conditions with commas
              </p>
            </div>

            {/* Current Medications */}
            <div>
              <Label htmlFor="dep-medications">Current Medications</Label>
              <Textarea
                id="dep-medications"
                value={currentMedications}
                onChange={(e) => setCurrentMedications(e.target.value)}
                placeholder="e.g., Salbutamol inhaler, Cetirizine 10mg"
                rows={2}
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Separate multiple medications with commas
              </p>
            </div>

            {/* Emergency Contact */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="dep-emergency-name">
                  Emergency Contact Name
                </Label>
                <Input
                  id="dep-emergency-name"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                  placeholder="Full name"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="dep-emergency-phone">
                  Emergency Contact Phone
                </Label>
                <Input
                  id="dep-emergency-phone"
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                  placeholder="+44 7911 123456"
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="dep-medical-notes">Additional Notes</Label>
              <Textarea
                id="dep-medical-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional medical information the doctor should know..."
                rows={3}
                className="mt-1.5"
              />
            </div>

            {/* Sharing Consent */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor="dep-sharing-consent"
                      className="font-medium"
                    >
                      Share with doctors
                    </Label>
                    <Switch
                      id="dep-sharing-consent"
                      checked={sharingConsent}
                      onCheckedChange={setSharingConsent}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    When enabled, doctors who have a confirmed booking with{" "}
                    {dependentName} can view this medical profile to provide
                    better care. You can revoke access at any time.
                  </p>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Medical Profile"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
