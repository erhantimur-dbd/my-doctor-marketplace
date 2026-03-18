"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, CheckCircle2, Star } from "lucide-react";
import { submitSurvey } from "@/actions/surveys";
import { useTranslations } from "next-intl";

interface SurveyFormProps {
  token: string;
  doctorName: string;
  appointmentDate: string;
}

export function SurveyForm({ token, doctorName, appointmentDate }: SurveyFormProps) {
  const t = useTranslations("survey");
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [wouldRecommend, setWouldRecommend] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (npsScore === null) {
      setError(t("select_score"));
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
          <h2 className="text-xl font-bold">{t("thank_you")}</h2>
          <p className="mt-2 text-muted-foreground">
            {t("thank_you_message")}
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
        <CardTitle>{t("title")}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {appointmentDate
            ? t.rich("subtitle_with_date", {
                doctorName,
                date: new Date(appointmentDate + "T00:00:00").toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }),
                strong: (chunks) => <strong>{chunks}</strong>,
              })
            : t.rich("subtitle_no_date", {
                doctorName,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* NPS Score */}
        <div>
          <Label className="mb-3 block text-center text-sm">
            {t("nps_question")}
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
            <span>{t("nps_low")}</span>
            <span>{t("nps_high")}</span>
          </div>
        </div>

        {/* Would Recommend */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <Label htmlFor="recommend" className="text-sm">
            {t("would_recommend")}
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
            {t("feedback_label")}
          </Label>
          <Textarea
            id="feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder={t("feedback_placeholder")}
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
              {t("submitting")}
            </>
          ) : (
            t("submit")
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          {t("confidential")}
        </p>
      </CardContent>
    </Card>
  );
}
