import { Card, CardContent } from "@/components/ui/card";
import { Ban } from "lucide-react";

interface FeatureUnavailableProps {
  title: string;
  description: string;
}

/**
 * Soft-launch unavailable state. Do not mention upgrading or unlocking —
 * these surfaces are hard-disabled for every tier.
 */
export function FeatureUnavailable({
  title,
  description,
}: FeatureUnavailableProps) {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Ban className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="mt-5 text-xl font-bold">{title}</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {description}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
