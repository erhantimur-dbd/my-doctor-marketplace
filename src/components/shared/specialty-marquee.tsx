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

export interface SpecialtyItem {
  slug: string;
  icon: string;
  label: string;
}

interface SpecialtyMarqueeProps {
  specialties: SpecialtyItem[];
}

export function SpecialtyMarquee({ specialties }: SpecialtyMarqueeProps) {
  // Duplicate list to create seamless loop
  const items = [...specialties, ...specialties];

  return (
    <div className="relative mt-8 overflow-hidden rounded-lg">
      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent md:w-12" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent md:w-12" />

      {/* Scrolling track */}
      <div className="flex animate-marquee gap-4 hover:[animation-play-state:paused]">
        {items.map((spec, i) => {
          const Icon = iconMap[spec.icon] || Stethoscope;
          const c = getSpecialtyColor(spec.slug);
          return (
            <Link
              key={`${spec.slug}-${i}`}
              href={`/specialties/${spec.slug}`}
              className="shrink-0"
            >
              <Card
                className={`group w-[8.5rem] cursor-pointer transition-all ${c.border} hover:shadow-md`}
              >
                <CardContent className="flex flex-col items-center gap-3 p-4 text-center">
                  <div
                    className={`rounded-full ${c.bg} p-3 transition-colors ${c.hoverBg}`}
                  >
                    <Icon className={`h-6 w-6 ${c.text}`} />
                  </div>
                  <span className="text-xs font-medium">
                    {spec.label}
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
