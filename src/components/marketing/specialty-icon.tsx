import {
  Activity,
  Apple,
  Baby,
  Bone,
  Brain,
  Droplets,
  Ear,
  Eye,
  Flower,
  Heart,
  HeartHandshake,
  Scan,
  Shield,
  Smile,
  Sparkles,
  Stethoscope,
  Wind,
} from "lucide-react";
import { getSpecialtyMeta } from "@/lib/constants/specialties";
import { cn } from "@/lib/utils";

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
  Bone,
  HeartHandshake,
};

export function SpecialtyIcon({
  slug,
  className,
}: {
  slug: string;
  className?: string;
}) {
  const meta = getSpecialtyMeta(slug);
  const Icon = (meta && iconMap[meta.icon]) || Stethoscope;
  return <Icon className={cn("h-5 w-5", className)} />;
}
