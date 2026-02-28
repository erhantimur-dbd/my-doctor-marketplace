"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Calendar,
  Bell,
  Stethoscope,
  CheckCircle2,
  Play,
  Pause,
} from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    step: "01",
    icon: Search,
    title: "Search & Discover",
    description:
      "Browse verified doctors by specialty, location, language, or price.",
    features: [
      "Filter by 24+ medical specialties",
      "Search across multiple European cities",
      "View transparent pricing upfront",
      "Read verified patient reviews",
    ],
    color: {
      step: "bg-blue-600",
      iconBg: "bg-blue-50",
      iconText: "text-blue-600",
      check: "text-blue-600",
      ring: "ring-blue-600/20",
      progress: "bg-blue-600",
      glow: "shadow-blue-500/20",
    },
  },
  {
    step: "02",
    icon: Calendar,
    title: "Book Instantly",
    description:
      "Choose a time slot from the doctor's real-time availability calendar.",
    features: [
      "Real-time availability calendar",
      "In-person or video consultations",
      "Secure online payment via Stripe",
      "Instant booking confirmation",
    ],
    color: {
      step: "bg-emerald-600",
      iconBg: "bg-emerald-50",
      iconText: "text-emerald-600",
      check: "text-emerald-600",
      ring: "ring-emerald-600/20",
      progress: "bg-emerald-600",
      glow: "shadow-emerald-500/20",
    },
  },
  {
    step: "03",
    icon: Bell,
    title: "Get Reminders",
    description:
      "Receive automatic reminders via email, SMS, or WhatsApp.",
    features: [
      "24-hour advance email reminder",
      "1-hour SMS/WhatsApp reminder",
      "In-app notification center",
      "Calendar integration",
    ],
    color: {
      step: "bg-amber-600",
      iconBg: "bg-amber-50",
      iconText: "text-amber-600",
      check: "text-amber-600",
      ring: "ring-amber-600/20",
      progress: "bg-amber-600",
      glow: "shadow-amber-500/20",
    },
  },
  {
    step: "04",
    icon: Stethoscope,
    title: "Visit Your Doctor",
    description:
      "Attend at the clinic or join a secure video call from anywhere.",
    features: [
      "Premium clinic locations",
      "HD video consultations",
      "Secure & private sessions",
      "Follow-up booking option",
    ],
    color: {
      step: "bg-teal-600",
      iconBg: "bg-teal-50",
      iconText: "text-teal-600",
      check: "text-teal-600",
      ring: "ring-teal-600/20",
      progress: "bg-teal-600",
      glow: "shadow-teal-500/20",
    },
  },
];

const STEP_DURATION = 4000; // 4 seconds per step

export function StepAnimation() {
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [visibleFeatures, setVisibleFeatures] = useState<number>(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (progressRef.current) clearInterval(progressRef.current);
  }, []);

  // Feature reveal animation — stagger each feature every 700ms
  useEffect(() => {
    setVisibleFeatures(0);
    let count = 0;
    const timer = setInterval(() => {
      count++;
      setVisibleFeatures(count);
      if (count >= 4) clearInterval(timer);
    }, 700);
    return () => clearInterval(timer);
  }, [activeStep]);

  // Auto-advance + progress bar
  useEffect(() => {
    if (!isPlaying) {
      clearTimers();
      return;
    }

    const progressInterval = 30; // Update progress every 30ms
    const startTime = Date.now();

    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / STEP_DURATION) * 100, 100);
      setProgress(pct);

      if (elapsed >= STEP_DURATION) {
        setActiveStep((prev) => (prev + 1) % steps.length);
        setProgress(0);
      }
    }, progressInterval);

    return clearTimers;
  }, [isPlaying, activeStep, clearTimers]);

  const goToStep = (index: number) => {
    setActiveStep(index);
    setProgress(0);
  };

  const togglePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  const current = steps[activeStep];
  const Icon = current.icon;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
        {/* Player control bar */}
        <div className="flex items-center gap-3 border-b bg-muted/40 px-4 py-2.5">
          <button
            type="button"
            onClick={togglePlayPause}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-110"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5 translate-x-[1px]" />
            )}
          </button>

          {/* Step indicators / scrubber */}
          <div className="flex flex-1 gap-1.5">
            {steps.map((s, i) => (
              <button
                key={s.step}
                type="button"
                onClick={() => goToStep(i)}
                className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted transition-colors"
                aria-label={`Go to step ${i + 1}: ${s.title}`}
              >
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-all",
                    i < activeStep
                      ? `w-full ${s.color.progress}`
                      : i === activeStep
                        ? s.color.progress
                        : "w-0"
                  )}
                  style={
                    i === activeStep ? { width: `${progress}%` } : undefined
                  }
                />
              </button>
            ))}
          </div>

          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {activeStep + 1} / {steps.length}
          </span>
        </div>

        {/* Main content area */}
        <div className="relative min-h-[340px] md:min-h-[300px]">
          {/* Animated content */}
          <div className="flex flex-col items-center gap-6 p-6 md:flex-row md:items-start md:gap-10 md:p-10">
            {/* Left: icon */}
            <div className="shrink-0">
              <div
                className={cn(
                  "flex h-24 w-24 items-center justify-center rounded-3xl shadow-lg transition-all duration-500 md:h-32 md:w-32",
                  current.color.iconBg,
                  current.color.glow
                )}
                key={activeStep}
              >
                <Icon
                  className={cn(
                    "h-12 w-12 animate-in fade-in zoom-in-75 duration-500 md:h-16 md:w-16",
                    current.color.iconText
                  )}
                />
              </div>
            </div>

            {/* Right: text content */}
            <div className="flex-1 text-center md:text-left" key={activeStep}>
              <div className="flex items-center justify-center gap-2.5 md:justify-start">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white animate-in fade-in slide-in-from-left-2 duration-300",
                    current.color.step
                  )}
                >
                  {current.step}
                </span>
                <h3 className="text-xl font-bold tracking-tight animate-in fade-in slide-in-from-left-4 duration-300 md:text-2xl">
                  {current.title}
                </h3>
              </div>

              <p className="mt-2.5 text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-500 md:text-base">
                {current.description}
              </p>

              <ul className="mt-4 space-y-2">
                {current.features.map((feature, fi) => (
                  <li
                    key={feature}
                    className={cn(
                      "flex items-center gap-2 text-sm transition-all duration-500",
                      fi < visibleFeatures
                        ? "translate-y-0 opacity-100"
                        : "translate-y-2 opacity-0"
                    )}
                  >
                    <CheckCircle2
                      className={cn("h-4 w-4 shrink-0", current.color.check)}
                    />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Step navigation dots */}
        <div className="flex items-center justify-center gap-2 border-t bg-muted/20 py-3">
          {steps.map((s, i) => {
            const isActive = i === activeStep;
            return (
              <button
                key={s.step}
                type="button"
                onClick={() => goToStep(i)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                  isActive
                    ? `${s.color.step} text-white shadow-sm`
                    : "bg-transparent text-muted-foreground hover:bg-muted"
                )}
                aria-label={`Step ${i + 1}: ${s.title}`}
              >
                <s.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{s.title}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
