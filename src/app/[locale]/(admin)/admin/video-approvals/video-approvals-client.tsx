"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { adminModerateProfileVideo } from "@/actions/doctor-profile-extras";
import { Link } from "@/i18n/navigation";

interface VideoRow {
  id: string;
  slug: string;
  profile_video_path: string | null;
  profile_video_status: string | null;
  profile_video_uploaded_at: string | null;
  profile:
    | { first_name: string; last_name: string; email: string }
    | { first_name: string; last_name: string; email: string }[]
    | null;
}

function videoUrl(path: string | null) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${path}`;
}

function profileName(profile: VideoRow["profile"]) {
  const p = Array.isArray(profile) ? profile[0] : profile;
  if (!p) return "Unknown doctor";
  return `${p.first_name} ${p.last_name}`;
}

export function VideoApprovalsClient({
  initialVideos,
}: {
  initialVideos: VideoRow[];
}) {
  const [videos, setVideos] = useState(initialVideos);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  async function moderate(
    doctorId: string,
    decision: "approved" | "rejected"
  ) {
    if (decision === "rejected" && !rejectReasons[doctorId]?.trim()) {
      toast.error("Add a rejection reason");
      return;
    }
    setBusyId(doctorId);
    const res = await adminModerateProfileVideo(
      doctorId,
      decision,
      rejectReasons[doctorId]
    );
    setBusyId(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setVideos((prev) => prev.filter((v) => v.id !== doctorId));
    toast.success(decision === "approved" ? "Video approved" : "Video rejected");
  }

  if (videos.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No videos pending approval.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {videos.map((v) => {
        const url = videoUrl(v.profile_video_path);
        return (
          <Card key={v.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg">{profileName(v.profile)}</CardTitle>
                <Link
                  href={`/doctors/${v.slug}`}
                  className="text-sm text-primary hover:underline"
                >
                  View profile
                </Link>
                {v.profile_video_uploaded_at && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Uploaded{" "}
                    {new Date(v.profile_video_uploaded_at).toLocaleString("en-GB")}
                  </p>
                )}
              </div>
              <Badge variant="secondary">Pending</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              {url ? (
                <video
                  src={url}
                  controls
                  className="max-h-80 w-full rounded-lg border bg-black"
                />
              ) : (
                <p className="text-sm text-muted-foreground">No video path</p>
              )}

              <Textarea
                placeholder="Rejection reason (required if rejecting)"
                value={rejectReasons[v.id] || ""}
                onChange={(e) =>
                  setRejectReasons((prev) => ({ ...prev, [v.id]: e.target.value }))
                }
                rows={2}
              />

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busyId === v.id}
                  onClick={() => moderate(v.id, "approved")}
                >
                  {busyId === v.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  disabled={busyId === v.id}
                  onClick={() => moderate(v.id, "rejected")}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
