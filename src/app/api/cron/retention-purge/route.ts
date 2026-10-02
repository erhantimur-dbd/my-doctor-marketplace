import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCronRequest } from "@/lib/cron/authorize";
import { deleteRoom } from "@/lib/daily/client";

/**
 * Daily retention purge. 04:30 UTC.
 * Apply runs only when platform_settings.retention_purge mode is apply.
 * off and dry_run call the function with p_dry_run true.
 * Storage and Daily failures leave the queue row's deleted_at null.
 */
export async function GET(request: NextRequest) {
  const denied = authorizeCronRequest(request);
  if (denied) return denied;

  const supabase = createAdminClient();
  const { data: setting } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "retention_purge")
    .maybeSingle();
  const mode =
    setting?.value && typeof setting.value === "object" && "mode" in setting.value
      ? String((setting.value as { mode?: string }).mode)
      : "dry_run";
  const dryRun = mode !== "apply";

  const { data, error } = await supabase.rpc("purge_expired_retention", {
    p_dry_run: dryRun,
    p_limit: 500,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (mode === "apply") {
    await drainQueuedObjects(supabase);
  }

  return NextResponse.json(data ?? {});
}

async function drainQueuedObjects(supabase: ReturnType<typeof createAdminClient>) {
  const { data: rows } = await supabase
    .from("retention_purge_objects")
    .select("id, bucket_id, object_name, daily_room_name")
    .is("deleted_at", null)
    .limit(500);

  for (const row of rows ?? []) {
    try {
      if (row.bucket_id && row.object_name) {
        const removed = await supabase.storage.from(row.bucket_id).remove([row.object_name]);
        if (removed.error) continue;
      }
      if (row.daily_room_name) {
        await deleteRoom(row.daily_room_name);
      }
      await supabase
        .from("retention_purge_objects")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", row.id);
    } catch {
      // Leave deleted_at null so a later run can retry.
    }
  }
}
