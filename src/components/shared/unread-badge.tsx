import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

export async function UnreadBadge() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Count unread notifications
  const { count: notifCount } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);

  // Count unread direct messages
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id");

  let msgCount = 0;
  if (conversations && conversations.length > 0) {
    const convIds = conversations.map((c) => c.id);
    const { count } = await supabase
      .from("direct_messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .neq("sender_id", user.id)
      .is("read_at", null);
    msgCount = count || 0;
  }

  const total = (notifCount || 0) + msgCount;

  if (total === 0) return null;

  return (
    <Badge
      variant="destructive"
      className="ml-auto h-5 min-w-5 px-1.5 text-xs"
    >
      {total > 99 ? "99+" : total}
    </Badge>
  );
}
