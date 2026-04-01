"use client";

import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { getSpecialtyColor } from "@/lib/constants/specialty-colors";
import {
  Stethoscope,
  Heart,
  Sparkles,
  Brain,
  Eye,
  Smile,
  Baby,
  Activity,
  Wind,
  Shield,
  Apple,
  Droplets,
  Ear,
  Flower,
  Scan,
} from "lucide-react";
import {
  useLiveAvailability,
  AvailabilityBadge,
  AvailabilityLegend,
} from "@/components/shared/live-availability-badge";

const iconMap: Record<string, React.ElementType> = {
  Stethoscope,
  Heart,
  Sparkles,
  Brain,
  Eye,
  Smile,
  Baby,
  Activity,
  Wind,
  Shield,
  Apple,
  Droplets,
  Ear,
  Flower,
  Scan,
  Bone: Activity,
  HeartHandshake: Heart,
};

export interface SpecialtyGridItem {
  slug: string;
  icon: string;
  label: string;
  desc: string;
}

interface SpecialtiesGridLiveProps {
  specialties: SpecialtyGridItem[];
  initialCounts?: Record<string, number>;
}

export function SpecialtiesGridLive({
  specialties,
  initialCounts = {},
}: SpecialtiesGridLiveProps) {
  const counts = useLiveAvailability(initialCounts);

  return (
    <>
      <AvailabilityLegend counts={counts} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {specialties.map((spec) => {
          const Icon = iconMap[spec.icon] || Stethoscope;
          const c = getSpecialtyColor(spec.slug);
          return (
            <Link key={spec.slug} href={`/specialties/${spec.slug}`}>
              <Card
                className={`group h-full cursor-pointer transition-all ${c.border} hover:shadow-md`}
              >
                <CardContent className="flex items-start gap-4 p-5">
                  <div
                    className={`relative shrink-0 rounded-xl ${c.bg} p-3 transition-colors ${c.hoverBg}`}
                  >
                    <Icon className={`h-6 w-6 ${c.text}`} />
                    <AvailabilityBadge count={counts[spec.slug] ?? 0} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold">{spec.label}</h3>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                      {spec.desc}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
