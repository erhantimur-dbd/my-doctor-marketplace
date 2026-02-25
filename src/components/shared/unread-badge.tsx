import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

export async function UnreadBadge() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  if (!count || count === 0) return null;

  return (
    <Badge
      variant="destructive"
      className="ml-auto h-5 min-w-5 px-1.5 text-xs"
    >
      {count > 99 ? "99+" : count}
    </Badge>
  );
}
