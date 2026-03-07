"use client";

import { useState, useTransition, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HeartPulse, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { updateMedicalProfile } from "./actions";

interface MedicalProfileData {
  blood_type: string | null;
  allergies: string[];
  chronic_conditions: string[];
  current_medications: string[];
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notes: string | null;
}

interface MedicalProfileSectionProps {
  medicalProfile: MedicalProfileData | null;
}

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function TagInput({
  label,
  placeholder,
  tags,
  onTagsChange,
}: {
  label: string;
  placeholder: string;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}) {
  const [inputValue, setInputValue] = useState("");

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = inputValue.trim();
      if (value && !tags.includes(value)) {
        onTagsChange([...tags, value]);
      }
      setInputValue("");
    }
  }

  function removeTag(index: number) {
    onTagsChange(tags.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="mt-1.5"
      />
      <p className="text-xs text-muted-foreground">
        Press Enter to add
      </p>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag, index) => (
            <Badge key={index} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(index)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function MedicalProfileSection({
  medicalProfile,
}: MedicalProfileSectionProps) {
  const [bloodType, setBloodType] = useState(
    medicalProfile?.blood_type || ""
  );
  const [allergies, setAllergies] = useState<string[]>(
    medicalProfile?.allergies || []
  );
  const [chronicConditions, setChronicConditions] = useState<string[]>(
    medicalProfile?.chronic_conditions || []
  );
  const [currentMedications, setCurrentMedications] = useState<string[]>(
    medicalProfile?.current_medications || []
  );
  const [emergencyName, setEmergencyName] = useState(
    medicalProfile?.emergency_contact_name || ""
  );
  const [emergencyPhone, setEmergencyPhone] = useState(
    medicalProfile?.emergency_contact_phone || ""
  );
  const [notes, setNotes] = useState(medicalProfile?.notes || "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSave() {
    startTransition(async () => {
      const result = await updateMedicalProfile({
        blood_type: bloodType || null,
        allergies,
        chronic_conditions: chronicConditions,
        current_medications: currentMedications,
        emergency_contact_name: emergencyName.trim() || null,
        emergency_contact_phone: emergencyPhone.trim() || null,
        notes: notes.trim() || null,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Medical profile updated.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HeartPulse className="h-4 w-4" />
          Medical Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This information helps your doctor provide better care. It is only
          visible to you and your treating physicians.
        </p>

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

        <TagInput
          label="Allergies"
          placeholder="e.g., Penicillin, Peanuts"
          tags={allergies}
          onTagsChange={setAllergies}
        />

        <TagInput
          label="Chronic Conditions"
          placeholder="e.g., Diabetes, Hypertension"
          tags={chronicConditions}
          onTagsChange={setChronicConditions}
        />

        <TagInput
          label="Current Medications"
          placeholder="e.g., Metformin 500mg"
          tags={currentMedications}
          onTagsChange={setCurrentMedications}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="emergency-name">Emergency Contact Name</Label>
            <Input
              id="emergency-name"
              value={emergencyName}
              onChange={(e) => setEmergencyName(e.target.value)}
              placeholder="Full name"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="emergency-phone">Emergency Contact Phone</Label>
            <Input
              id="emergency-phone"
              type="tel"
              value={emergencyPhone}
              onChange={(e) => setEmergencyPhone(e.target.value)}
              placeholder="+1 234 567 8900"
              className="mt-1.5"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="medical-notes">Additional Notes</Label>
          <Textarea
            id="medical-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional medical information your doctor should know..."
            rows={3}
            className="mt-1.5"
          />
        </div>

        <div className="flex justify-end">
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
      </CardContent>
    </Card>
  );
}
