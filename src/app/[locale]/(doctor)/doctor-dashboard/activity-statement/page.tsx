import { notFound, redirect } from "next/navigation";
import { loadActivityStatement } from "@/lib/statements/access";
import { renderActivityStatementBody } from "@/lib/statements/render-activity-statement-html";
import { StatementControls } from "./statement-controls";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "MyDoctors360 activity statement",
};

export default async function ActivityStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; scope?: string }>;
}) {
  const params = await searchParams;
  const loaded = await loadActivityStatement({
    month: params.month,
    scope: params.scope,
  });

  if (loaded.status === "unauthenticated") redirect("/en/login");
  if (loaded.status === "not_doctor") redirect("/en/register-doctor");
  if (loaded.status === "hidden") notFound();

  if (loaded.status === "error") {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">MyDoctors360 activity statement</h1>
        <p className="text-muted-foreground">
          The statement could not be loaded. Please try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-0">
      <StatementControls
        monthKey={loaded.monthKey}
        scope={loaded.scope}
        canViewOrganization={loaded.canViewOrganization}
        organizationName={loaded.organizationName}
      />
      <div
        dangerouslySetInnerHTML={{
          __html: renderActivityStatementBody(loaded.statement),
        }}
      />
    </div>
  );
}
