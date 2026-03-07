"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { toast } from "sonner";
import { adminBulkModerateReviews } from "@/actions/admin";
import { approveReview, hideReview } from "@/actions/admin";
import { CheckCircle, EyeOff, Loader2, Star } from "lucide-react";

interface ReviewData {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  is_visible: boolean;
  is_verified: boolean;
  doctor_response: string | null;
  created_at: string;
  patient_name: string;
  doctor_name: string;
  doctor_slug: string;
}

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

function SingleReviewActions({ reviewId, isVisible }: { reviewId: string; isVisible: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [currentVisibility, setCurrentVisibility] = useState(isVisible);

  function handleApprove() {
    startTransition(async () => {
      const result = await approveReview(reviewId);
      if (result?.error) {
        toast.error(result.error);
      } else {
        setCurrentVisibility(true);
        toast.success("Review approved and now visible");
      }
    });
  }

  function handleHide() {
    startTransition(async () => {
      const result = await hideReview(reviewId);
      if (result?.error) {
        toast.error(result.error);
      } else {
        setCurrentVisibility(false);
        toast.success("Review hidden");
      }
    });
  }

  return (
    <div className="flex gap-2">
      {!currentVisibility && (
        <Button variant="default" size="sm" onClick={handleApprove} disabled={isPending} className="bg-green-600 hover:bg-green-700">
          <CheckCircle className="mr-1 h-4 w-4" />
          {isPending ? "..." : "Approve"}
        </Button>
      )}
      {currentVisibility && (
        <Button variant="outline" size="sm" onClick={handleHide} disabled={isPending} className="text-red-600 hover:bg-red-50">
          <EyeOff className="mr-1 h-4 w-4" />
          {isPending ? "..." : "Hide"}
        </Button>
      )}
    </div>
  );
}

export function BulkReviewList({
  reviews,
  isVisibleTab,
}: {
  reviews: ReviewData[];
  isVisibleTab: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const toggleAll = () => {
    if (selected.size === reviews.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(reviews.map((r) => r.id)));
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleBulkAction = (action: "approve" | "hide") => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    startTransition(async () => {
      const result = await adminBulkModerateReviews(ids, action);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          `${ids.length} review${ids.length !== 1 ? "s" : ""} ${action === "approve" ? "approved" : "hidden"}`
        );
        setSelected(new Set());
      }
    });
  };

  if (reviews.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          {isVisibleTab ? "No approved reviews yet" : "No reviews awaiting moderation"}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Select All */}
      <div className="flex items-center gap-2 px-1">
        <Checkbox
          checked={selected.size === reviews.length}
          onCheckedChange={toggleAll}
          aria-label="Select all"
        />
        <span className="text-sm text-muted-foreground">
          Select all ({reviews.length})
        </span>
      </div>

      {/* Review Cards */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <Card key={review.id}>
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selected.has(review.id)}
                  onCheckedChange={() => toggleOne(review.id)}
                  className="mt-1"
                />
                <div className="flex flex-1 items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <StarRating rating={review.rating} />
                      <Badge variant="outline">
                        {review.is_visible ? "Visible" : "Hidden"}
                      </Badge>
                      {review.is_verified && (
                        <Badge variant="secondary" className="bg-green-50 text-green-700">
                          Verified
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{review.patient_name}</span>
                      <span className="text-muted-foreground">reviewed</span>
                      <Link
                        href={`/doctors/${review.doctor_slug}`}
                        className="font-medium text-primary hover:underline"
                      >
                        Dr. {review.doctor_name}
                      </Link>
                    </div>
                    {review.title && <p className="text-sm font-semibold">{review.title}</p>}
                    {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
                    {review.doctor_response && (
                      <div className="mt-3 rounded-lg border-l-4 border-blue-300 bg-blue-50/50 p-3">
                        <p className="text-xs font-medium text-blue-700">Doctor&apos;s Response</p>
                        <p className="mt-1 text-sm text-muted-foreground">{review.doctor_response}</p>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(review.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <div className="ml-4">
                    <SingleReviewActions reviewId={review.id} isVisible={review.is_visible} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sticky Bulk Bar */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 z-10 mx-auto flex w-fit items-center gap-3 rounded-lg border bg-background px-4 py-2.5 shadow-lg">
          <span className="text-sm font-medium">{selected.size} selected</span>
          {!isVisibleTab && (
            <Button
              size="sm"
              className="gap-1.5 bg-green-600 hover:bg-green-700"
              onClick={() => handleBulkAction("approve")}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
              Approve Selected
            </Button>
          )}
          {isVisibleTab && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-red-600 hover:bg-red-50"
              onClick={() => handleBulkAction("hide")}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
              Hide Selected
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={isPending}>
            Clear
          </Button>
        </div>
      )}
    </>
  );
}
