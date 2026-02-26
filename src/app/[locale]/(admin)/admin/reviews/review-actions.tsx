"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { approveReview, hideReview } from "@/actions/admin";
import { CheckCircle, EyeOff } from "lucide-react";

export function ReviewActions({
  reviewId,
  isVisible,
}: {
  reviewId: string;
  isVisible: boolean;
}) {
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
        <Button
          variant="default"
          size="sm"
          onClick={handleApprove}
          disabled={isPending}
          className="bg-green-600 hover:bg-green-700"
        >
          <CheckCircle className="mr-1 h-4 w-4" />
          {isPending ? "..." : "Approve"}
        </Button>
      )}
      {currentVisibility && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleHide}
          disabled={isPending}
          className="text-red-600 hover:bg-red-50"
        >
          <EyeOff className="mr-1 h-4 w-4" />
          {isPending ? "..." : "Hide"}
        </Button>
      )}
    </div>
  );
}
