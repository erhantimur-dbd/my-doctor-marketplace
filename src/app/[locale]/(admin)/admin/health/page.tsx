import { requireAdminPage } from "@/lib/admin/require-admin-page";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Server,
} from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";

const CRON_JOBS = [
  {
    path: "/api/cron/send-reminders",
    schedule: "*/15 * * * *",
    description: "Booking reminders (email / SMS / WhatsApp)",
  },
  {
    path: "/api/cron/cleanup-expired",
    schedule: "*/5 * * * *",
    description: "Expire pending payments & stale data",
  },
  {
    path: "/api/cron/sync-calendars",
    schedule: "*/10 * * * *",
    description: "Google / Microsoft / CalDAV calendar sync",
  },
  {
    path: "/api/cron/treatment-reminders",
    schedule: "0 9 * * *",
    description: "Treatment plan reminders (daily 09:00 UTC)",
  },
  {
    path: "/api/cron/satisfaction-surveys",
    schedule: "0 10 * * *",
    description: "Send NPS surveys after completed bookings",
  },
  {
    path: "/api/cron/verify-doctor-credentials",
    schedule: "0 4 * * *",
    description: "Weekly GMC / credential re-checks",
  },
];

function envStatus(name: string): { ok: boolean; label: string } {
  const present = Boolean(process.env[name]);
  return { ok: present, label: name };
}

export default async function AdminHealthPage() {
  await requireAdminPage();

  const start = Date.now();
  let dbOk = false;
  let dbMs = 0;
  let dbError: string | undefined;

  try {
    const dbStart = Date.now();
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .limit(1);
    dbMs = Date.now() - dbStart;
    if (error) throw new Error(error.message);
    dbOk = true;
  } catch (err: any) {
    dbError = err?.message || "Database unreachable";
  }

  const envChecks = [
    envStatus("NEXT_PUBLIC_SUPABASE_URL"),
    envStatus("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    envStatus("SUPABASE_SERVICE_ROLE_KEY"),
    envStatus("STRIPE_SECRET_KEY"),
    envStatus("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"),
    envStatus("STRIPE_WEBHOOK_SECRET"),
    envStatus("RESEND_API_KEY"),
    envStatus("JWT_SECRET"),
    envStatus("CRON_SECRET"),
    envStatus("NEXT_PUBLIC_APP_URL"),
    envStatus("ADMIN_EMAILS"),
    envStatus("OPENAI_API_KEY"),
    envStatus("DAILY_API_KEY"),
    envStatus("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"),
  ];

  const allEnvOk = envChecks.every((c) => c.ok);
  const overallOk = dbOk && allEnvOk;
  const totalMs = Date.now() - start;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Activity className="h-6 w-6" />
            System Health
          </h1>
          <p className="text-sm text-muted-foreground">
            Integration status, env config presence, and cron schedule
          </p>
        </div>
        <Badge
          variant={overallOk ? "default" : "destructive"}
          className="text-sm"
        >
          {overallOk ? "Healthy" : "Degraded"}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div
              className={`rounded-full p-3 ${dbOk ? "bg-green-50" : "bg-red-50"}`}
            >
              {dbOk ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Database</p>
              <p className="font-semibold">{dbOk ? "OK" : "Error"}</p>
              <p className="text-xs text-muted-foreground">
                {dbOk ? `${dbMs}ms` : dbError}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div
              className={`rounded-full p-3 ${allEnvOk ? "bg-green-50" : "bg-amber-50"}`}
            >
              <Server
                className={`h-5 w-5 ${allEnvOk ? "text-green-600" : "text-amber-600"}`}
              />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Env keys present</p>
              <p className="font-semibold">
                {envChecks.filter((c) => c.ok).length}/{envChecks.length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-50 p-3">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Check latency</p>
              <p className="font-semibold">{totalMs}ms</p>
              <p className="text-xs text-muted-foreground">
                {process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "dev"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Environment variables</CardTitle>
          <p className="text-sm text-muted-foreground">
            Presence only — values are never shown
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {envChecks.map((c) => (
              <div
                key={c.label}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <code className="text-xs">{c.label}</code>
                {c.ok ? (
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-700"
                  >
                    set
                  </Badge>
                ) : (
                  <Badge variant="destructive">missing</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scheduled crons (vercel.json)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Protected by CRON_SECRET. Last-run timestamps require Vercel
            dashboard or logging.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {CRON_JOBS.map((job) => (
            <div
              key={job.path}
              className="flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-mono text-sm">{job.path}</p>
                <p className="text-xs text-muted-foreground">
                  {job.description}
                </p>
              </div>
              <Badge variant="outline" className="w-fit font-mono text-xs">
                {job.schedule}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Public health endpoint:{" "}
        <code className="rounded bg-muted px-1">GET /api/health</code>
      </p>
    </div>
  );
}
