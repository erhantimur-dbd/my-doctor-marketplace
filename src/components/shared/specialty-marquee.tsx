"use client";

import { useRef, useEffect, useCallback } from "react";
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);
  const rafRef = useRef<number | null>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedRef = useRef(0.5); // px per frame — base auto-scroll speed

  // Auto-scroll loop
  const tick = useCallback(() => {
    const el = scrollRef.current;
    if (el && autoScrollRef.current) {
      el.scrollLeft += speedRef.current;
      // When we've scrolled past the first set, jump back seamlessly
      const halfWidth = el.scrollWidth / 2;
      if (el.scrollLeft >= halfWidth) {
        el.scrollLeft -= halfWidth;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [tick]);

  // Pause auto-scroll on touch / interaction, resume after 3s idle
  const pauseAutoScroll = useCallback(() => {
    autoScrollRef.current = false;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      autoScrollRef.current = true;
    }, 3000);
  }, []);

  // Pause on hover (desktop)
  const handleMouseEnter = useCallback(() => {
    autoScrollRef.current = false;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }, []);

  const handleMouseLeave = useCallback(() => {
    autoScrollRef.current = true;
  }, []);

  // Handle manual scroll (touch swipe or mouse wheel)
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Seamless loop: wrap scroll position
    const halfWidth = el.scrollWidth / 2;
    if (el.scrollLeft >= halfWidth) {
      el.scrollLeft -= halfWidth;
    } else if (el.scrollLeft <= 0) {
      el.scrollLeft += halfWidth;
    }
  }, []);

  return (
    <div className="relative mt-8 overflow-hidden rounded-lg">
      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-background to-transparent md:w-12" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-background to-transparent md:w-12" />

      {/* Scrollable + auto-scrolling track */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
        onTouchStart={pauseAutoScroll}
        onTouchMove={pauseAutoScroll}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onScroll={handleScroll}
      >
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
