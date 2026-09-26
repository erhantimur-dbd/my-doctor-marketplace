"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { submitPostVisitFeedback } from "@/actions/post-visit-feedback";
import {
  PLATFORM_FEEDBACK_DISCLAIMER,
  PLATFORM_FEEDBACK_NOTE_LABEL,
  PLATFORM_FEEDBACK_NOTE_PLACEHOLDER,
  POST_VISIT_FREE_TEXT_MAX,
  POST_VISIT_QUESTIONS,
  type PostVisitRatingKey,
} from "@/lib/feedback/post-visit";

function StarSelector({
  value,
  onChange,
  label,
}: {
  value: number | null;
  onChange: (value: number) => void;
  label: string;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div
      className="flex gap-1"
      role="radiogroup"
      aria-label={label}
      onMouseLeave={() => setHovered(0)}
    >
      {Array.from({ length: 5 }).map((_, index) => {
        const starValue = index + 1;
        const filled = starValue <= (hovered || value || 0);
        return (
          <button
            key={starValue}
            type="button"
            role="radio"
            aria-checked={value === starValue}
            aria-label={`${starValue} out of 5`}
            className="rounded-sm p-0.5 transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onMouseEnter={() => setHovered(starValue)}
            onClick={() => onChange(starValue)}
          >
            <Star
              className={`h-7 w-7 transition-colors ${
                filled
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

export function PostVisitFeedbackForm({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [ratings, setRatings] = useState<Partial<Record<PostVisitRatingKey, number>>>({});
  const [freeText, setFreeText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const setRating = (key: PostVisitRatingKey, value: number) => {
    setRatings((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = () => {
    startTransition(async () => {
      setError(null);
      const result = await submitPostVisitFeedback({
        bookingId,
        overallRating: ratings.overallRating ?? null,
        bookingExperienceRating: ratings.bookingExperienceRating ?? null,
        waitingRoomRating: ratings.waitingRoomRating ?? null,
        videoQualityRating: ratings.videoQualityRating ?? null,
        bookAgainRating: ratings.bookAgainRating ?? null,
        freeText,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setSavedNote(freeText.trim().length > 0);
      setSubmitted(true);
      router.refresh();
    });
  };

  if (submitted) {
    return (
      <div className="space-y-2 py-2 text-center" data-testid="post-visit-feedback-thanks">
        <CheckCircle2 className="mx-auto h-8 w-8 text-green-600" />
        <p className="font-medium">Thanks — your platform feedback is saved.</p>
        <p className="text-sm text-muted-foreground">{PLATFORM_FEEDBACK_DISCLAIMER}</p>
        {savedNote ? (
          <p className="text-sm text-muted-foreground">
            Your note is stored privately for a human check. It is not published.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      className="space-y-5"
      data-testid="post-visit-feedback-form"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit();
      }}
    >
      <p className="text-sm text-muted-foreground">{PLATFORM_FEEDBACK_DISCLAIMER}</p>

      {POST_VISIT_QUESTIONS.map((question) => (
        <fieldset key={question.key} className="space-y-2">
          <legend className="text-sm font-medium">{question.prompt}</legend>
          <StarSelector
            label={question.prompt}
            value={ratings[question.key] ?? null}
            onChange={(value) => setRating(question.key, value)}
          />
        </fieldset>
      ))}

      <div className="space-y-1.5">
        <Label htmlFor="platform-feedback-note">{PLATFORM_FEEDBACK_NOTE_LABEL}</Label>
        <Textarea
          id="platform-feedback-note"
          value={freeText}
          maxLength={POST_VISIT_FREE_TEXT_MAX}
          rows={3}
          placeholder={PLATFORM_FEEDBACK_NOTE_PLACEHOLDER}
          onChange={(event) => setFreeText(event.target.value)}
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving
          </>
        ) : (
          "Submit private feedback"
        )}
      </Button>
    </form>
  );
}
