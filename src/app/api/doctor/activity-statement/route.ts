import { NextResponse } from "next/server";
import { renderActivityStatementHtml } from "@/lib/statements/render-activity-statement-html";
import { loadActivityStatement } from "@/lib/statements/access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const loaded = await loadActivityStatement({
    month: url.searchParams.get("month"),
    scope: url.searchParams.get("scope"),
  });

  if (loaded.status === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (loaded.status === "error") {
    return NextResponse.json({ error: "Unavailable" }, { status: 500 });
  }
  if (loaded.status !== "ok") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filename = `mydoctors360-activity-statement-${loaded.monthKey}.html`;
  return new NextResponse(renderActivityStatementHtml(loaded.statement), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
