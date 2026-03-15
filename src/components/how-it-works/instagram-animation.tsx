"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Calendar,
  Bell,
  Stethoscope,
  CheckCircle2,
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
      "Search across multiple cities",
      "Transparent pricing upfront",
      "Verified patient reviews",
    ],
    color: {
      step: "bg-blue-600",
      iconBg: "bg-blue-50",
      iconText: "text-blue-600",
      check: "text-blue-500",
      progress: "bg-blue-600",
      glow: "shadow-blue-500/25",
      gradient: "from-blue-600 to-blue-500",
    },
  },
  {
    step: "02",
    icon: Calendar,
    title: "Book Instantly",
    description:
      "Choose a time from the doctor's real-time availability calendar.",
    features: [
      "Real-time availability",
      "In-person or video consults",
      "Secure payment via Stripe",
      "Instant confirmation",
    ],
    color: {
      step: "bg-emerald-600",
      iconBg: "bg-emerald-50",
      iconText: "text-emerald-600",
      check: "text-emerald-500",
      progress: "bg-emerald-600",
      glow: "shadow-emerald-500/25",
      gradient: "from-emerald-600 to-emerald-500",
    },
  },
  {
    step: "03",
    icon: Bell,
    title: "Get Reminders",
    description:
      "Receive automatic reminders via email, SMS, or WhatsApp.",
    features: [
      "24-hour email reminder",
      "1-hour SMS/WhatsApp alert",
      "In-app notifications",
      "Calendar integration",
    ],
    color: {
      step: "bg-amber-600",
      iconBg: "bg-amber-50",
      iconText: "text-amber-600",
      check: "text-amber-500",
      progress: "bg-amber-600",
      glow: "shadow-amber-500/25",
      gradient: "from-amber-600 to-amber-500",
    },
  },
  {
    step: "04",
    icon: Stethoscope,
    title: "Visit Your Doctor",
    description:
      "Attend at the clinic or join a secure video call from anywhere.",
    features: [
      "Top-rated clinic locations",
      "HD video consultations",
      "Secure & private sessions",
      "Easy follow-up booking",
    ],
    color: {
      step: "bg-teal-600",
      iconBg: "bg-teal-50",
      iconText: "text-teal-600",
      check: "text-teal-500",
      progress: "bg-teal-600",
      glow: "shadow-teal-500/25",
      gradient: "from-teal-600 to-teal-500",
    },
  },
];

const STEP_DURATION = 4000;
const TOTAL_LOOPS = 2; // Play through twice then stop

export function InstagramAnimation() {
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [visibleFeatures, setVisibleFeatures] = useState<number>(0);
  const [loopCount, setLoopCount] = useState(0);
  const [finished, setFinished] = useState(false);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (progressRef.current) clearInterval(progressRef.current);
  }, []);

  // Feature reveal
  useEffect(() => {
    setVisibleFeatures(0);
    let count = 0;
    const timer = setInterval(() => {
      count++;
      setVisibleFeatures(count);
      if (count >= 4) clearInterval(timer);
    }, 600);
    return () => clearInterval(timer);
  }, [activeStep]);

  // Auto-advance
  useEffect(() => {
    if (finished) return;

    const startTime = Date.now();

    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / STEP_DURATION) * 100, 100);
      setProgress(pct);

      if (elapsed >= STEP_DURATION) {
        const nextStep = (activeStep + 1) % steps.length;
        if (nextStep === 0) {
          const newLoop = loopCount + 1;
          setLoopCount(newLoop);
          if (newLoop >= TOTAL_LOOPS) {
            setFinished(true);
            clearTimers();
            return;
          }
        }
        setActiveStep(nextStep);
        setProgress(0);
      }
    }, 30);

    return clearTimers;
  }, [activeStep, loopCount, finished, clearTimers]);

  const current = steps[activeStep];
  const Icon = current.icon;

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-between overflow-hidden bg-white p-0">
      {/* Top progress bars */}
      <div className="flex w-full gap-1 px-4 pt-3">
        {steps.map((s, i) => (
          <div
            key={s.step}
            className="relative h-1 flex-1 overflow-hidden rounded-full bg-gray-200"
          >
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-all duration-75",
                i < activeStep || (finished && i <= activeStep)
                  ? `w-full ${s.color.progress}`
                  : i === activeStep && !finished
                    ? s.color.progress
                    : "w-0"
              )}
              style={
                i === activeStep && !finished
                  ? { width: `${progress}%` }
                  : undefined
              }
            />
          </div>
        ))}
      </div>

      {/* Brand header */}
      <div className="mt-4 text-center">
        <h1 className="text-lg font-bold tracking-tight text-gray-900">
          MyDoctors360
        </h1>
        <p className="mt-0.5 text-xs font-medium text-gray-400">
          HOW IT WORKS
        </p>
      </div>

      {/* Main content */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8">
        {/* Icon */}
        <div
          className={cn(
            "flex h-20 w-20 items-center justify-center rounded-2xl shadow-xl transition-all duration-500",
            current.color.iconBg,
            current.color.glow
          )}
          key={`icon-${activeStep}-${loopCount}`}
        >
          <Icon
            className={cn(
              "h-10 w-10 animate-in fade-in zoom-in-75 duration-500",
              current.color.iconText
            )}
          />
        </div>

        {/* Step number + title */}
        <div
          className="mt-5 text-center"
          key={`text-${activeStep}-${loopCount}`}
        >
          <div className="flex items-center justify-center gap-2">
            <span
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white animate-in fade-in slide-in-from-left-2 duration-300",
                current.color.step
              )}
            >
              {current.step}
            </span>
            <h2 className="text-xl font-bold tracking-tight text-gray-900 animate-in fade-in slide-in-from-left-4 duration-300">
              {current.title}
            </h2>
          </div>

          <p className="mt-2 text-sm text-gray-500 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {current.description}
          </p>
        </div>

        {/* Features */}
        <ul className="mt-5 w-full max-w-xs space-y-2">
          {current.features.map((feature, fi) => (
            <li
              key={feature}
              className={cn(
                "flex items-center gap-2.5 text-sm text-gray-700 transition-all duration-500",
                fi < visibleFeatures
                  ? "translate-y-0 opacity-100"
                  : "translate-y-3 opacity-0"
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

      {/* Step dots at bottom */}
      <div className="mb-5 flex items-center gap-3">
        {steps.map((s, i) => {
          const isActive = i === activeStep;
          const StepIcon = s.icon;
          return (
            <div
              key={s.step}
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300",
                isActive
                  ? `${s.color.step} text-white shadow-md`
                  : "bg-gray-100 text-gray-400"
              )}
            >
              <StepIcon className="h-3.5 w-3.5" />
            </div>
          );
        })}
      </div>

      {/* Brand footer */}
      <div className="mb-4 text-center">
        <p className="text-xs font-medium text-gray-300">
          mydoctors360.com
        </p>
      </div>
    </div>
  );
}
