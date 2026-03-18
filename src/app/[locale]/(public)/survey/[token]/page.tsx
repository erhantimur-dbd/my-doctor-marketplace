import { getSurveyByToken } from "@/actions/surveys";
import { SurveyForm } from "./survey-form";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function SurveyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = await getTranslations("survey");
  const result = await getSurveyByToken(token);

  if (result.error || !result.survey) {
    return (
      <div className="mx-auto max-w-lg py-20 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-xl font-bold">{t("not_found")}</h2>
            <p className="mt-2 text-muted-foreground">
              {t("not_found_message")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result.survey.submitted) {
    return (
      <div className="mx-auto max-w-lg py-20 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
            <h2 className="text-xl font-bold">{t("thank_you")}</h2>
            <p className="mt-2 text-muted-foreground">
              {t("already_submitted")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg py-12 px-4">
      <SurveyForm
        token={result.survey.token}
        doctorName={result.survey.doctorName}
        appointmentDate={result.survey.appointmentDate}
      />
    </div>
  );
}
