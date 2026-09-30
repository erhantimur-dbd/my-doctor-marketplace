/**
 * Lock every Daily room whose name starts with md- so a leftover public
 * URL cannot admit anyone. Posting privacy "private" again is idempotent.
 * This module does not read the environment and does not call Daily unless
 * the caller passes a fetch implementation and an API key.
 */

const DAILY_ROOMS = "https://api.daily.co/v1/rooms";
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGES = 200;

export type LockLegacyRoomsResult = {
  matched: string[];
  locked: number;
  skipped: number;
  dryRun: boolean;
};

type RoomRow = {
  id?: string;
  name?: string;
};

function isMdRoom(name: string): boolean {
  return name.startsWith("md-");
}

export async function lockLegacyDailyRooms(input: {
  apiKey: string;
  dryRun: boolean;
  fetchImpl?: typeof fetch;
  log?: (line: string) => void;
  pageSize?: number;
}): Promise<LockLegacyRoomsResult> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) {
    throw new Error("DAILY_API_KEY is required");
  }

  const fetchImpl = input.fetchImpl ?? fetch;
  const log = input.log ?? ((line: string) => console.log(line));
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
  const matched: string[] = [];
  const seenIds = new Set<string>();
  let skipped = 0;
  let locked = 0;
  let startingAfter: string | null = null;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = new URL(DAILY_ROOMS);
    url.searchParams.set("limit", String(pageSize));
    if (startingAfter) url.searchParams.set("starting_after", startingAfter);

    const response = await fetchImpl(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      throw new Error(`Daily list rooms failed (${response.status})`);
    }

    const body = (await response.json()) as { data?: RoomRow[] };
    const rows = Array.isArray(body.data) ? body.data : [];
    if (rows.length === 0) break;

    let advanced = false;
    for (const row of rows) {
      const id = typeof row.id === "string" ? row.id : "";
      const name = typeof row.name === "string" ? row.name : "";
      if (id) {
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        advanced = true;
      }
      if (!name || !isMdRoom(name)) {
        skipped += 1;
        continue;
      }
      matched.push(name);
      log(
        input.dryRun
          ? `[lock-daily-rooms] dry-run ${name}`
          : `[lock-daily-rooms] lock ${name}`
      );
      if (input.dryRun) continue;

      const update = await fetchImpl(`${DAILY_ROOMS}/${encodeURIComponent(name)}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          privacy: "private",
          properties: { enable_knocking: false },
        }),
      });
      if (!update.ok) {
        throw new Error(`Daily lock failed for ${name} (${update.status})`);
      }
      locked += 1;
    }

    const lastId = rows[rows.length - 1]?.id;
    if (!advanced || rows.length < pageSize || !lastId || lastId === startingAfter) {
      break;
    }
    startingAfter = lastId;
  }

  log(
    `[lock-daily-rooms] matched=${matched.length} locked=${locked} skipped=${skipped} dryRun=${input.dryRun}`
  );

  return { matched, locked, skipped, dryRun: input.dryRun };
}
