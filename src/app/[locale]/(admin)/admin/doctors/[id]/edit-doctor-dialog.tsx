"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Pencil } from "lucide-react";
import { adminUpdateDoctorProfile } from "@/actions/admin";
import { toast } from "sonner";

interface EditDoctorDialogProps {
  doctorId: string;
  currentValues: {
    consultation_fee_cents: number;
    video_consultation_fee_cents: number;
    bio: string;
    languages: string[];
    years_of_experience: number;
  };
}

export function EditDoctorDialog({
  doctorId,
  currentValues,
}: EditDoctorDialogProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [consultationFee, setConsultationFee] = useState(
    currentValues.consultation_fee_cents
  );
  const [videoFee, setVideoFee] = useState(
    currentValues.video_consultation_fee_cents
  );
  const [bio, setBio] = useState(currentValues.bio || "");
  const [languages, setLanguages] = useState(
    currentValues.languages?.join(", ") || ""
  );
  const [experience, setExperience] = useState(
    currentValues.years_of_experience || 0
  );

  const handleSave = () => {
    startTransition(async () => {
      const fields: Record<string, unknown> = {
        consultation_fee_cents: consultationFee,
        video_consultation_fee_cents: videoFee,
        bio,
        languages: languages
          .split(",")
          .map((l) => l.trim())
          .filter(Boolean),
        years_of_experience: experience,
      };
      const result = await adminUpdateDoctorProfile(doctorId, fields);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Doctor profile updated");
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Doctor Profile</DialogTitle>
          <DialogDescription>
            Update the doctor&apos;s profile details. Changes take effect immediately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>In-Person Fee (cents)</Label>
              <Input
                type="number"
                min={0}
                value={consultationFee}
                onChange={(e) => setConsultationFee(Number(e.target.value))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>Video Fee (cents)</Label>
              <Input
                type="number"
                min={0}
                value={videoFee}
                onChange={(e) => setVideoFee(Number(e.target.value))}
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label>Years of Experience</Label>
            <Input
              type="number"
              min={0}
              max={60}
              value={experience}
              onChange={(e) => setExperience(Number(e.target.value))}
              className="mt-1.5 w-[120px]"
            />
          </div>
          <div>
            <Label>Languages (comma-separated)</Label>
            <Input
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              placeholder="English, German, Turkish"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Bio</Label>
            <Textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              className="mt-1.5"
              placeholder="Doctor bio..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
