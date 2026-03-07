import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { Clock, CheckCircle } from "lucide-react";
import { BulkReviewList } from "./bulk-review-actions";

type TabKey = "pending" | "approved";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab: TabKey = rawTab === "approved" ? "approved" : "pending";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/en/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/en");

  // Counts for tab badges
  const [{ count: pendingCount }, { count: approvedCount }] =
    await Promise.all([
      supabase
        .from("reviews")
        .select("*", { count: "exact", head: true })
        .eq("is_visible", false),
      supabase
        .from("reviews")
        .select("*", { count: "exact", head: true })
        .eq("is_visible", true),
    ]);

  // Fetch reviews based on tab
  let query = supabase
    .from("reviews")
    .select(
      `id, rating, title, comment, is_visible, is_verified, doctor_response, created_at,
       patient:profiles!reviews_patient_id_fkey(first_name, last_name),
       doctor:doctors!inner(slug, profile:profiles!doctors_profile_id_fkey(first_name, last_name))`
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (tab === "pending") {
    query = query.eq("is_visible", false);
  } else {
    query = query.eq("is_visible", true);
  }

  const { data: rawReviews } = await query;

  // Serialize for client component
  const reviews = (rawReviews || []).map((r: any) => ({
    id: r.id,
    rating: r.rating,
    title: r.title,
    comment: r.comment,
    is_visible: r.is_visible,
    is_verified: r.is_verified,
    doctor_response: r.doctor_response,
    created_at: r.created_at,
    patient_name: `${r.patient?.first_name || ""} ${r.patient?.last_name || ""}`.trim(),
    doctor_name: `${r.doctor?.profile?.first_name || ""} ${r.doctor?.profile?.last_name || ""}`.trim(),
    doctor_slug: r.doctor?.slug || "",
  }));

  const tabs: { key: TabKey; label: string; count: number | null; icon: React.ElementType }[] = [
    { key: "pending", label: "Pending Approval", count: pendingCount, icon: Clock },
    { key: "approved", label: "Approved", count: approvedCount, icon: CheckCircle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Review Moderation</h1>
        <p className="text-muted-foreground">
          Approve or hide patient reviews before they appear on doctor profiles.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/reviews?tab=${t.key}`}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {(t.count ?? 0) > 0 && (
              <Badge
                variant={t.key === "pending" ? "destructive" : "secondary"}
                className="ml-1 h-5 min-w-5 px-1.5 text-xs"
              >
                {t.count}
              </Badge>
            )}
          </Link>
        ))}
      </div>

      {/* Review Cards with Bulk Selection */}
      <BulkReviewList reviews={reviews} isVisibleTab={tab === "approved"} />
    </div>
  );
}
