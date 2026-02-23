"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Star,
  MessageSquare,
  Loader2,
  Pencil,
  Send,
  TrendingUp,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReviewRow = any;

function createSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [avgRating, setAvgRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [ratingDistribution, setRatingDistribution] = useState<
    Record<number, number>
  >({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });

  // Response state
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: doctor } = await supabase
      .from("doctors")
      .select("id, avg_rating, total_reviews")
      .eq("profile_id", user.id)
      .single();
    if (!doctor) return;

    setAvgRating(Number(doctor.avg_rating) || 0);
    setTotalReviews(doctor.total_reviews || 0);

    const { data } = await supabase
      .from("reviews")
      .select(
        "id, rating, title, comment, doctor_response, doctor_responded_at, created_at, patient:profiles!reviews_patient_id_fkey(first_name, last_name)"
      )
      .eq("doctor_id", doctor.id)
      .eq("is_visible", true)
      .order("created_at", { ascending: false });

    const reviewList = (data as unknown as ReviewRow[]) || [];
    setReviews(reviewList);

    // Calculate distribution
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    reviewList.forEach((r) => {
      dist[r.rating] = (dist[r.rating] || 0) + 1;
    });
    setRatingDistribution(dist);

    setLoading(false);
  }

  async function submitResponse(reviewId: string) {
    if (!responseText.trim()) return;
    setSubmitting(true);

    const supabase = createSupabase();
    await supabase
      .from("reviews")
      .update({
        doctor_response: responseText.trim(),
        doctor_responded_at: new Date().toISOString(),
      })
      .eq("id", reviewId);

    setRespondingTo(null);
    setResponseText("");
    setSubmitting(false);
    loadData();
  }

  function startEditing(review: ReviewRow) {
    setRespondingTo(review.id);
    setResponseText(review.doctor_response || "");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reviews</h1>
        <p className="text-muted-foreground">
          See what patients are saying and respond to reviews
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-yellow-50 p-3">
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Average Rating</p>
                <p className="text-2xl font-bold">{avgRating.toFixed(1)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-50 p-3">
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Reviews</p>
                <p className="text-2xl font-bold">{totalReviews}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="sm:col-span-2">
          <CardContent className="p-6">
            <p className="mb-3 text-sm font-medium text-muted-foreground">
              Rating Distribution
            </p>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = ratingDistribution[star] || 0;
                const pct =
                  totalReviews > 0
                    ? Math.round((count / totalReviews) * 100)
                    : 0;
                return (
                  <div key={star} className="flex items-center gap-2">
                    <span className="w-4 text-sm font-medium">{star}</span>
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <div className="flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-yellow-400 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs text-muted-foreground">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reviews List */}
      <Card>
        <CardHeader>
          <CardTitle>All Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          {reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Star className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                No reviews yet. Reviews will appear here after patient visits.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {reviews.map((review) => (
                <div key={review.id}>
                  <div className="flex items-start gap-4">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {review.patient.first_name.charAt(0)}
                        {review.patient.last_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">
                            {review.patient.first_name}{" "}
                            {review.patient.last_name.charAt(0)}.
                          </p>
                          <div className="mt-0.5 flex items-center gap-2">
                            <div className="flex">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < review.rating
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-muted"
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(review.created_at).toLocaleDateString(
                                "en-GB",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                }
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {review.title && (
                        <p className="mt-2 font-medium">{review.title}</p>
                      )}
                      {review.comment && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {review.comment}
                        </p>
                      )}

                      {/* Doctor's response */}
                      {review.doctor_response && respondingTo !== review.id && (
                        <div className="mt-3 rounded-lg bg-muted/50 p-4">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium">Your Response</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditing(review)}
                            >
                              <Pencil className="mr-1 h-3 w-3" />
                              Edit
                            </Button>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {review.doctor_response}
                          </p>
                        </div>
                      )}

                      {/* Respond / Edit form */}
                      {respondingTo === review.id ? (
                        <div className="mt-3 space-y-2">
                          <Textarea
                            placeholder="Write your response to this review..."
                            value={responseText}
                            onChange={(e) => setResponseText(e.target.value)}
                            rows={3}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => submitResponse(review.id)}
                              disabled={submitting || !responseText.trim()}
                            >
                              {submitting ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <Send className="mr-1 h-3 w-3" />
                              )}
                              {review.doctor_response
                                ? "Update Response"
                                : "Submit Response"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setRespondingTo(null);
                                setResponseText("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        !review.doctor_response && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-3"
                            onClick={() => {
                              setRespondingTo(review.id);
                              setResponseText("");
                            }}
                          >
                            <MessageSquare className="mr-1 h-3 w-3" />
                            Respond
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                  <Separator className="mt-6" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
