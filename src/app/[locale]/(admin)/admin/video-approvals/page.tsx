import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VideoApprovalsClient } from "./video-approvals-client";

export default async function AdminVideoApprovalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/");

  const admin = createAdminClient();
  const { data: pending } = await admin
    .from("doctors")
    .select(
      `id, slug, profile_video_path, profile_video_status, profile_video_uploaded_at,
       profile:profiles!doctors_profile_id_fkey(first_name, last_name, email)`
    )
    .eq("profile_video_status", "pending")
    .order("profile_video_uploaded_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profile video approvals</h1>
        <p className="text-muted-foreground">
          Review doctor intro videos before they go live on public profiles.
        </p>
      </div>
      <VideoApprovalsClient initialVideos={pending || []} />
    </div>
  );
}
