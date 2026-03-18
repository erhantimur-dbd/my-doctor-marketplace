"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, CheckCircle2, Star } from "lucide-react";
import { submitSurvey } from "@/actions/surveys";

interface SurveyFormProps {
  token: string;
  doctorName: string;
  appointmentDate: string;
}

export function SurveyForm({ token, doctorName, appointmentDate }: SurveyFormProps) {
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [wouldRecommend, setWouldRecommend] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const npsLabels: Record<number, string> = {
    0: "Not at all likely",
    5: "Neutral",
    10: "Extremely likely",
  };

  const handleSubmit = () => {
    if (npsScore === null) {
      setError("Please select a score.");
      return;
    }

    startTransition(async () => {
      setError(null);
      const result = await submitSurvey(token, {
        nps_score: npsScore,
        would_recommend: wouldRecommend,
        feedback_text: feedback || undefined,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setSubmitted(true);
    });
  };

  if (submitted) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <h2 className="text-xl font-bold">Thank You!</h2>
          <p className="mt-2 text-muted-foreground">
            Your feedback helps us improve our service. We appreciate your time.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Star className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>How was your experience?</CardTitle>
        <p className="text-sm text-muted-foreground">
          Your appointment with <strong>Dr. {doctorName}</strong>
          {appointmentDate && (
            <>
              {" "}on{" "}
              {new Date(appointmentDate + "T00:00:00").toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </>
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* NPS Score */}
        <div>
          <Label className="mb-3 block text-center text-sm">
            How likely are you to recommend our service to a friend or colleague?
          </Label>
          <div className="flex flex-wrap justify-center gap-1.5">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                onClick={() => setNpsScore(i)}
                className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium transition-all ${
                  npsScore === i
                    ? i <= 6
                      ? "border-red-500 bg-red-500 text-white"
                      : i <= 8
                        ? "border-yellow-500 bg-yellow-500 text-white"
                        : "border-green-500 bg-green-500 text-white"
                    : "border-gray-200 hover:border-gray-400 hover:bg-gray-50"
                }`}
              >
                {i}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
            <span>{npsLabels[0]}</span>
            <span>{npsLabels[10]}</span>
          </div>
        </div>

        {/* Would Recommend */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <Label htmlFor="recommend" className="text-sm">
            Would you book with us again?
          </Label>
          <Switch
            id="recommend"
            checked={wouldRecommend}
            onCheckedChange={setWouldRecommend}
          />
        </div>

        {/* Feedback */}
        <div>
          <Label htmlFor="feedback" className="mb-1.5 block text-sm">
            Any additional feedback? (optional)
          </Label>
          <Textarea
            id="feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Tell us what went well or what we could improve..."
            rows={3}
          />
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={npsScore === null || isPending}
          className="w-full"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Submit Feedback"
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Your response is confidential and takes less than a minute.
        </p>
      </CardContent>
    </Card>
  );
}
