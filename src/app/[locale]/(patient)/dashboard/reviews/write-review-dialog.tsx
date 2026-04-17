"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Star, Loader2, Pencil, Check } from "lucide-react";
import { toast } from "sonner";
import { submitReview, updatePatientReview } from "./actions";
import {
  MAX_ENDORSEMENTS_PER_REVIEW,
  skillsForSpecialties,
} from "@/lib/constants/skills";
import { cn } from "@/lib/utils";

interface WriteReviewDialogProps {
  bookingId: string;
  doctorId: string;
  doctorName: string;
  /** Specialty slugs of the doctor, used to filter the skill chip list. */
  doctorSpecialtySlugs?: string[];
  isEditing?: boolean;
  reviewId?: string;
  initialRating?: number;
  initialTitle?: string;
  initialComment?: string;
  initialSkillSlugs?: string[];
}

function StarSelector({
  rating,
  onRatingChange,
}: {
  rating: number;
  onRatingChange: (rating: number) => void;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex gap-1">
      {Array.from({ length: 5 }).map((_, i) => {
        const starValue = i + 1;
        const isFilled = starValue <= (hovered || rating);

        return (
          <button
            key={i}
            type="button"
            className="rounded-sm p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onMouseEnter={() => setHovered(starValue)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onRatingChange(starValue)}
          >
            <Star
              className={`h-7 w-7 transition-colors ${
                isFilled
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-muted-foreground/40"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

export function WriteReviewDialog({
  bookingId,
  doctorId,
  doctorName,
  doctorSpecialtySlugs,
  isEditing = false,
  reviewId,
  initialRating = 0,
  initialTitle = "",
  initialComment = "",
  initialSkillSlugs = [],
}: WriteReviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(initialRating);
  const [title, setTitle] = useState(initialTitle);
  const [comment, setComment] = useState(initialComment);
  const [selectedSkills, setSelectedSkills] = useState<string[]>(initialSkillSlugs);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const availableSkills = skillsForSpecialties(doctorSpecialtySlugs ?? []);

  function toggleSkill(slug: string) {
    setSelectedSkills((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= MAX_ENDORSEMENTS_PER_REVIEW) {
        toast.info(`You can select up to ${MAX_ENDORSEMENTS_PER_REVIEW} skills.`);
        return prev;
      }
      return [...prev, slug];
    });
  }

  function handleSubmit() {
    if (rating === 0) {
      toast.error("Please select a rating.");
      return;
    }

    startTransition(async () => {
      if (isEditing && reviewId) {
        const result = await updatePatientReview({
          reviewId,
          rating,
          title: title.trim() || null,
          comment: comment.trim() || null,
          skillSlugs: selectedSkills,
        });

        if (result.error) {
          toast.error(result.error);
          return;
        }

        toast.success("Review updated successfully!");
      } else {
        const result = await submitReview({
          bookingId,
          doctorId,
          rating,
          title: title.trim() || null,
          comment: comment.trim() || null,
          skillSlugs: selectedSkills,
        });

        if (result.error) {
          toast.error(result.error);
          return;
        }

        toast.success("Review submitted successfully!");
      }

      setOpen(false);
      if (!isEditing) {
        setRating(0);
        setTitle("");
        setComment("");
        setSelectedSkills([]);
      }
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={isEditing ? "outline" : "default"}>
          <Pencil className="mr-1 h-3.5 w-3.5" />
          {isEditing ? "Edit" : "Write Review"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Review" : "Write a Review"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Update your review for ${doctorName}`
              : `Share your experience with ${doctorName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Rating</Label>
            <StarSelector rating={rating} onRatingChange={setRating} />
            {rating > 0 && (
              <p className="text-sm text-muted-foreground">
                {rating === 1
                  ? "Poor"
                  : rating === 2
                    ? "Fair"
                    : rating === 3
                      ? "Good"
                      : rating === 4
                        ? "Very Good"
                        : "Excellent"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-title">Title (optional)</Label>
            <Input
              id="review-title"
              placeholder="Summarize your experience"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-comment">Comment (optional)</Label>
            <Textarea
              id="review-comment"
              placeholder="Tell others about your experience..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={1000}
            />
            {comment.length > 0 && (
              <p className="text-xs text-muted-foreground text-right">
                {comment.length}/1000
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>
              What did they do well?{" "}
              <span className="font-normal text-muted-foreground">
                (optional, up to {MAX_ENDORSEMENTS_PER_REVIEW})
              </span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {availableSkills.map((skill) => {
                const active = selectedSkills.includes(skill.slug);
                const disabled =
                  !active && selectedSkills.length >= MAX_ENDORSEMENTS_PER_REVIEW;
                return (
                  <button
                    key={skill.slug}
                    type="button"
                    onClick={() => toggleSkill(skill.slug)}
                    disabled={disabled}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent",
                      disabled && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    {active && <Check className="h-3 w-3" />}
                    {skill.label}
                  </button>
                );
              })}
            </div>
            {selectedSkills.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {selectedSkills.length} / {MAX_ENDORSEMENTS_PER_REVIEW} selected
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || rating === 0}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditing ? "Updating..." : "Submitting..."}
              </>
            ) : isEditing ? (
              "Update Review"
            ) : (
              "Submit Review"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
