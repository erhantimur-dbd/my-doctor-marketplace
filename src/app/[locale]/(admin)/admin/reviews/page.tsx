import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { Star, Clock, CheckCircle } from "lucide-react";
import { ReviewActions } from "./review-actions";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

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
    .limit(50);

  if (tab === "pending") {
    query = query.eq("is_visible", false);
  } else {
    query = query.eq("is_visible", true);
  }

  const { data: reviews } = await query;

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

      {/* Review Cards */}
      <div className="space-y-4">
        {(!reviews || reviews.length === 0) ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {tab === "pending"
                ? "No reviews awaiting moderation"
                : "No approved reviews yet"}
            </CardContent>
          </Card>
        ) : (
          reviews.map((review: any) => (
            <Card key={review.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    {/* Header */}
                    <div className="flex flex-wrap items-center gap-3">
                      <StarRating rating={review.rating} />
                      <Badge variant="outline">
                        {review.is_visible ? "Visible" : "Hidden"}
                      </Badge>
                      {review.is_verified && (
                        <Badge
                          variant="secondary"
                          className="bg-green-50 text-green-700"
                        >
                          Verified
                        </Badge>
                      )}
                    </div>

                    {/* Patient & Doctor */}
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">
                        {review.patient?.first_name}{" "}
                        {review.patient?.last_name}
                      </span>
                      <span className="text-muted-foreground">reviewed</span>
                      <Link
                        href={`/doctors/${review.doctor?.slug}`}
                        className="font-medium text-primary hover:underline"
                      >
                        Dr. {review.doctor?.profile?.first_name}{" "}
                        {review.doctor?.profile?.last_name}
                      </Link>
                    </div>

                    {/* Review Content */}
                    {review.title && (
                      <p className="text-sm font-semibold">{review.title}</p>
                    )}
                    {review.comment && (
                      <p className="text-sm text-muted-foreground">
                        {review.comment}
                      </p>
                    )}

                    {/* Doctor Response */}
                    {review.doctor_response && (
                      <div className="mt-3 rounded-lg border-l-4 border-blue-300 bg-blue-50/50 p-3">
                        <p className="text-xs font-medium text-blue-700">
                          Doctor&apos;s Response
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {review.doctor_response}
                        </p>
                      </div>
                    )}

                    {/* Date */}
                    <p className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="ml-4">
                    <ReviewActions
                      reviewId={review.id}
                      isVisible={review.is_visible}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
