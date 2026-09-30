/**
 * Lock every md-* Daily room to private and turn knocking off.
 *
 * Idempotent: posting the same privacy again is safe. Logs room names and
 * counts only. Pip runs this at deploy. Do not run it against the real
 * Daily account from CI or from a cloud agent.
 *
 * Use the react-server condition, same as the repair script, so a future
 * import of a server-only module does not throw under plain tsx.
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/lock-daily-rooms.ts --help
 *   DAILY_API_KEY=... NODE_OPTIONS=--conditions=react-server npx tsx scripts/lock-daily-rooms.ts --dry-run
 *   DAILY_API_KEY=... NODE_OPTIONS=--conditions=react-server npx tsx scripts/lock-daily-rooms.ts
 *
 * `--help` prints usage and does not call Daily.
 */
import { lockLegacyDailyRooms } from "../src/lib/daily/lock-legacy-rooms";

const USAGE =
  "Usage: NODE_OPTIONS=--conditions=react-server npx tsx scripts/lock-daily-rooms.ts [--dry-run]";

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(USAGE);
    return;
  }

  const dryRun = process.argv.includes("--dry-run");
  const apiKey = process.env.DAILY_API_KEY?.trim() ?? "";
  if (!apiKey) {
    console.error("Missing DAILY_API_KEY. Refusing to list rooms.");
    process.exit(1);
  }

  const result = await lockLegacyDailyRooms({ apiKey, dryRun });
  if (dryRun) {
    console.log(
      `[lock-daily-rooms] dry-run finished. ${result.matched.length} md-* room(s) would be locked.`
    );
  }
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("lock-daily-rooms.ts") || entry.endsWith("lock-daily-rooms.js")) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : "lock failed";
    console.error(`[lock-daily-rooms] ${message}`);
    process.exit(1);
  });
}
