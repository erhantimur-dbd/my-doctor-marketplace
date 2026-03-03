import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

interface ReviewSummaryCardProps {
  summary: string;
  sentimentTags: string[];
  reviewSummaryTitle: string;
  poweredByAi: string;
}

const tagColors: Record<string, string> = {
  very_positive: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  positive: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  mixed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  negative: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export function ReviewSummaryCard({
  summary,
  sentimentTags,
  reviewSummaryTitle,
  poweredByAi,
}: ReviewSummaryCardProps) {
  return (
    <Card className="border-primary/10 bg-primary/[0.02]">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">{reviewSummaryTitle}</h4>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          {summary}
        </p>

        {sentimentTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {sentimentTags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <p className="mt-3 text-[10px] text-muted-foreground/60 flex items-center gap-1">
          <Sparkles className="h-2.5 w-2.5" />
          {poweredByAi}
        </p>
      </CardContent>
    </Card>
  );
}
