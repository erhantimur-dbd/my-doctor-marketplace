import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Crown, Lock, ArrowRight } from "lucide-react";

interface UpgradePromptProps {
  feature: string;
  description?: string;
}

export function UpgradePrompt({ feature, description }: UpgradePromptProps) {
  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <Card className="mx-auto max-w-lg border-dashed">
        <CardContent className="flex flex-col items-center p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-7 w-7 text-primary" />
          </div>
          <h2 className="mt-5 text-xl font-bold">
            Upgrade to Unlock {feature}
          </h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            {description ||
              `${feature} is available on Professional and Premium plans. Upgrade your subscription to access this feature and grow your practice.`}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/doctor-dashboard/subscription">
                <Crown className="mr-2 h-4 w-4" />
                View Plans
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/doctor-dashboard">
                Back to Dashboard
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
