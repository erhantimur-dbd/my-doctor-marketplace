import { getSurveyByToken } from "@/actions/surveys";
import { SurveyForm } from "./survey-form";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle } from "lucide-react";

export default async function SurveyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await getSurveyByToken(token);

  if (result.error || !result.survey) {
    return (
      <div className="mx-auto max-w-lg py-20 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
            <h2 className="text-xl font-bold">Survey Not Found</h2>
            <p className="mt-2 text-muted-foreground">
              This survey link may have expired or is no longer valid.
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
            <h2 className="text-xl font-bold">Thank You!</h2>
            <p className="mt-2 text-muted-foreground">
              Your feedback has already been recorded. We appreciate your time.
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
