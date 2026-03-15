"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

interface CompletionItem {
  label: string;
  completed: boolean;
  href: string;
}

interface ProfileCompletionCardProps {
  doctor: {
    bio: string | null;
    specialties: string[] | null;
    stripe_account_id: string | null;
    consultation_types: string[] | null;
    verification_status: string;
    has_testing_addon?: boolean;
    provider_type?: string;
  };
  profile: {
    avatar_url: string | null;
  };
  hasAvailability: boolean;
  hasEducation: boolean;
  hasServices: boolean;
  hasTestingServices: boolean;
}

export function ProfileCompletionCard({
  doctor,
  profile,
  hasAvailability,
  hasEducation,
  hasServices,
  hasTestingServices,
}: ProfileCompletionCardProps) {
  const isTestingProvider = doctor.provider_type === "testing_service";

  const items: CompletionItem[] = [
    {
      label: "Add a profile photo",
      completed: !!profile.avatar_url,
      href: "/doctor-dashboard/profile",
    },
    {
      label: "Write your bio",
      completed: !!doctor.bio && doctor.bio.length > 20,
      href: "/doctor-dashboard/profile",
    },
    {
      label: "Add specialties",
      completed: !!doctor.specialties && doctor.specialties.length > 0,
      href: "/doctor-dashboard/profile",
    },
    {
      label: "Add education & qualifications",
      completed: hasEducation,
      href: "/doctor-dashboard/profile",
    },
    {
      label: "Set up consultation types",
      completed:
        !!doctor.consultation_types && doctor.consultation_types.length > 0,
      href: "/doctor-dashboard/profile",
    },
    {
      label: "Add your services & pricing",
      completed: hasServices,
      href: "/doctor-dashboard/profile",
    },
    // Show testing services step for testing providers or doctors with the addon
    ...(isTestingProvider || doctor.has_testing_addon
      ? [
          {
            label: "Set up your test catalogue & pricing",
            completed: hasTestingServices,
            href: "/doctor-dashboard/medical-testing",
          },
        ]
      : []),
    {
      label: "Set your availability",
      completed: hasAvailability,
      href: "/doctor-dashboard/calendar",
    },
    {
      label: "Connect Stripe for payments",
      completed: !!doctor.stripe_account_id,
      href: "/doctor-dashboard/subscription",
    },
  ];

  const completedCount = items.filter((i) => i.completed).length;
  const percentage = Math.round((completedCount / items.length) * 100);

  // Don't show if fully complete
  if (percentage === 100) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          Complete Your Profile
          <span className="text-sm font-normal text-muted-foreground">
            {completedCount}/{items.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Progress value={percentage} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {percentage}% complete — {items.length - completedCount} items remaining
          </p>
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                item.completed
                  ? "text-muted-foreground"
                  : "hover:bg-primary/10 font-medium"
              }`}
            >
              {item.completed ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
              )}
              <span className={item.completed ? "line-through" : ""}>
                {item.label}
              </span>
              {!item.completed && (
                <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
