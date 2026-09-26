"use client";

import { Button } from "@/components/ui/button";
import type { ActivityStatementScope } from "@/lib/statements/activity-statement";

export function StatementControls({
  monthKey,
  scope,
  canViewOrganization,
  organizationName,
}: {
  monthKey: string;
  scope: ActivityStatementScope;
  canViewOrganization: boolean;
  organizationName: string | null;
}) {
  const downloadHref = `/api/doctor/activity-statement?month=${encodeURIComponent(monthKey)}&scope=${encodeURIComponent(scope)}`;

  return (
    <form method="get" className="flex flex-wrap items-end gap-3 print:hidden">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Month</span>
        <input
          type="month"
          name="month"
          defaultValue={monthKey}
          required
          className="h-9 rounded-md border bg-background px-3"
        />
      </label>
      {canViewOrganization ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Statement for</span>
          <select
            name="scope"
            defaultValue={scope}
            className="h-9 rounded-md border bg-background px-3"
          >
            <option value="doctor">This doctor</option>
            <option value="organization">{organizationName || "This clinic"}</option>
          </select>
        </label>
      ) : null}
      <Button type="submit" variant="outline">
        Show month
      </Button>
      <Button type="button" variant="outline" onClick={() => window.print()}>
        Print or save as PDF
      </Button>
      <Button variant="default" asChild>
        <a href={downloadHref}>Download</a>
      </Button>
    </form>
  );
}
