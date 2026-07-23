import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThumbsUp } from "lucide-react";
import {
  aggregateNpsMetrics,
  sortRecentSurveyResponses,
} from "@/lib/analytics/nps";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

export default async function AdminNpsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/en/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/en");

  const { data: surveyRows } = await supabase
    .from("satisfaction_surveys")
    .select(
      "id, nps_score, would_recommend, feedback_text, submitted_at, token, booking_id"
    )
    .not("submitted_at", "is", null)
    .order("submitted_at", { ascending: false })
    .limit(200);

  const rows = surveyRows || [];
  const nps = aggregateNpsMetrics(rows);
  const recent = sortRecentSurveyResponses(rows, 50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ThumbsUp className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">NPS &amp; satisfaction</h1>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin/analytics">Back to analytics</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Overall NPS</p>
            <p className="text-3xl font-bold">{nps.npsScore ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Responses</p>
            <p className="text-3xl font-bold">{nps.responseCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Promoters</p>
            <p className="text-3xl font-bold text-green-600">
              {nps.promoters}{" "}
              <span className="text-base font-normal text-muted-foreground">
                ({nps.promoterRate}%)
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Passives</p>
            <p className="text-3xl font-bold text-amber-600">
              {nps.passives}{" "}
              <span className="text-base font-normal text-muted-foreground">
                ({nps.passiveRate}%)
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Detractors</p>
            <p className="text-3xl font-bold text-red-600">
              {nps.detractors}{" "}
              <span className="text-base font-normal text-muted-foreground">
                ({nps.detractorRate}%)
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {nps.averageScore != null && (
        <p className="text-sm text-muted-foreground">
          Average score {nps.averageScore}/10 · Would recommend:{" "}
          {nps.recommendYes} yes / {nps.recommendNo} no
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Submitted responses</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No submitted surveys yet. Cron sends invites 24–48h after completed
              appointments.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">Score</th>
                    <th className="px-3 py-2 font-medium">Recommend</th>
                    <th className="px-3 py-2 font-medium">Feedback</th>
                    <th className="px-3 py-2 font-medium">Submitted</th>
                    <th className="px-3 py-2 font-medium">Booking</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr
                      key={row.id || row.token || String(row.submitted_at)}
                      className="border-t align-top"
                    >
                      <td className="px-3 py-2 font-semibold">{row.nps_score}</td>
                      <td className="px-3 py-2">
                        {row.would_recommend === true
                          ? "Yes"
                          : row.would_recommend === false
                            ? "No"
                            : "—"}
                      </td>
                      <td className="max-w-md px-3 py-2 text-muted-foreground whitespace-pre-wrap">
                        {row.feedback_text || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {row.submitted_at
                          ? new Date(row.submitted_at).toLocaleString("en-GB")
                          : "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {(row as { booking_id?: string }).booking_id?.slice(0, 8) ||
                          "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
