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
  const positionRef = useRef(0); // sub-pixel accumulator
  const speedRef = useRef(0.6); // px per frame — base auto-scroll speed

  // Auto-scroll loop using sub-pixel accumulator
  // (scrollLeft only accepts integers, so we track fractional position ourselves)
  const tick = useCallback(() => {
    const el = scrollRef.current;
    if (el && autoScrollRef.current) {
      positionRef.current += speedRef.current;
      const newPos = Math.floor(positionRef.current);
      if (newPos !== el.scrollLeft) {
        el.scrollLeft = newPos;
      }
      // When we've scrolled past the first set, jump back seamlessly
      const halfWidth = el.scrollWidth / 2;
      if (positionRef.current >= halfWidth) {
        positionRef.current -= halfWidth;
        el.scrollLeft = Math.floor(positionRef.current);
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
      // Sync accumulator to current manual position before resuming
      const el = scrollRef.current;
      if (el) positionRef.current = el.scrollLeft;
      autoScrollRef.current = true;
    }, 3000);
  }, []);

  // Pause on hover (desktop)
  const handleMouseEnter = useCallback(() => {
    autoScrollRef.current = false;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }, []);

  const handleMouseLeave = useCallback(() => {
    const el = scrollRef.current;
    if (el) positionRef.current = el.scrollLeft;
    autoScrollRef.current = true;
  }, []);

  // Handle manual scroll (touch swipe) — wrap for seamless loop
  const handleScroll = useCallback(() => {
    if (autoScrollRef.current) return; // only wrap during manual interaction
    const el = scrollRef.current;
    if (!el) return;
    const halfWidth = el.scrollWidth / 2;
    if (el.scrollLeft >= halfWidth) {
      el.scrollLeft -= halfWidth;
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
