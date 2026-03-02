import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number; // 0-5 decimal
  totalReviews?: number;
  size?: "sm" | "md";
  showCount?: boolean;
}

export function StarRating({
  rating,
  totalReviews,
  size = "sm",
  showCount = false,
}: StarRatingProps) {
  const starSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const ratingTextSize = size === "sm" ? "text-sm" : "text-base";
  const countTextSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((starIndex) => {
          const fill = Math.min(1, Math.max(0, rating - (starIndex - 1)));

          if (fill >= 1) {
            // Fully filled star
            return (
              <Star
                key={starIndex}
                className={cn(starSize, "fill-yellow-400 text-yellow-400")}
              />
            );
          }

          if (fill > 0) {
            // Partially filled star — clip overlay
            return (
              <span key={starIndex} className={cn("relative inline-flex", starSize)}>
                {/* Gray outline (background) */}
                <Star className={cn(starSize, "text-muted-foreground/40 absolute inset-0")} />
                {/* Yellow fill clipped to percentage */}
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${fill * 100}%` }}
                >
                  <Star className={cn(starSize, "fill-yellow-400 text-yellow-400")} />
                </span>
              </span>
            );
          }

          // Empty star
          return (
            <Star
              key={starIndex}
              className={cn(starSize, "text-muted-foreground/40")}
            />
          );
        })}
      </div>
      <span className={cn("font-medium", ratingTextSize)}>
        {Number(rating).toFixed(1)}
      </span>
      {showCount && totalReviews !== undefined && (
        <span className={cn("text-muted-foreground", countTextSize)}>
          ({totalReviews})
        </span>
      )}
    </div>
  );
}
