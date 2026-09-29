import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("GTM-critical cron registration", () => {
  const vercel = JSON.parse(read("vercel.json")) as {
    crons: { path: string; schedule: string }[];
  };

  const required = [
    { path: "/api/cron/send-reminders", schedule: "*/15 * * * *" },
    { path: "/api/cron/cleanup-expired", schedule: "*/5 * * * *" },
    { path: "/api/cron/request-reviews", schedule: "0 11 * * *" },
    { path: "/api/cron/satisfaction-surveys", schedule: "0 10 * * *" },
    { path: "/api/cron/wallet-credit-transfers", schedule: "*/15 * * * *" },
    { path: "/api/cron/invoice-status", schedule: "0 8 * * *" },
    { path: "/api/cron/license-enforcement", schedule: "0 3 * * *" },
    { path: "/api/cron/generate-review-summaries", schedule: "0 6 * * *" },
  ] as const;

  it.each(required)(
    "registers $path on schedule $schedule",
    ({ path, schedule }) => {
      expect(vercel.crons).toContainEqual({ path, schedule });
      expect(read(`src/app${path}/route.ts`)).toContain("authorizeCronRequest");
    }
  );

  it("lists every vercel.json cron on the admin health page", () => {
    const health = read("src/app/[locale]/(admin)/admin/health/page.tsx");
    for (const cron of vercel.crons) {
      expect(health).toContain(`path: "${cron.path}"`);
      expect(health).toContain(`schedule: "${cron.schedule}"`);
    }
  });
});
