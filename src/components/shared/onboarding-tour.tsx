"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useOnboarding } from "@/hooks/use-onboarding";
import type { OnboardingStep } from "./onboarding-steps";

interface OnboardingTourProps {
  /** Unique tour identifier */
  tourId: string;
  /** Steps to display */
  steps: OnboardingStep[];
}

export function OnboardingTour({ tourId, steps }: OnboardingTourProps) {
  const {
    isCompleted,
    isActive,
    currentStep,
    nextStep,
    prevStep,
    skipTour,
  } = useOnboarding(tourId);

  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({
    opacity: 0,
  });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const positionTooltip = useCallback(() => {
    if (!isActive || isCompleted || !steps[currentStep]) return;

    const step = steps[currentStep];
    const target = document.querySelector(step.targetSelector);

    if (!target) {
      // Target not found — position center-screen as fallback
      setTooltipStyle({
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 10001,
        opacity: 1,
      });
      return;
    }

    const rect = target.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;
    const tooltipWidth = tooltipEl?.offsetWidth || 320;
    const tooltipHeight = tooltipEl?.offsetHeight || 160;
    const gap = 12;

    let top = 0;
    let left = 0;

    switch (step.position) {
      case "bottom":
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "top":
        top = rect.top - tooltipHeight - gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + gap;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - gap;
        break;
    }

    // Clamp within viewport
    left = Math.max(8, Math.min(left, window.innerWidth - tooltipWidth - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - tooltipHeight - 8));

    // Scroll target into view if needed
    target.scrollIntoView({ behavior: "smooth", block: "center" });

    setTooltipStyle({
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      zIndex: 10001,
      opacity: 1,
    });
  }, [isActive, isCompleted, currentStep, steps]);

  useEffect(() => {
    if (!mounted || !isActive || isCompleted) return;

    // Small delay to let DOM settle
    const timer = setTimeout(positionTooltip, 300);
    window.addEventListener("resize", positionTooltip);
    window.addEventListener("scroll", positionTooltip, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", positionTooltip);
      window.removeEventListener("scroll", positionTooltip, true);
    };
  }, [mounted, isActive, isCompleted, positionTooltip]);

  if (!mounted || !isActive || isCompleted || !steps[currentStep]) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  return (
    <>
      {/* Overlay backdrop */}
      <div
        className="fixed inset-0 z-[10000] bg-black/40 transition-opacity"
        onClick={skipTour}
      />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={tooltipStyle}
        className="w-80 rounded-lg border bg-card p-4 shadow-xl transition-all duration-200"
      >
        {/* Close button */}
        <button
          onClick={skipTour}
          className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Close tour"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Step indicator */}
        <p className="mb-1 text-xs text-muted-foreground">
          Step {currentStep + 1} of {steps.length}
        </p>

        <h3 className="mb-2 text-sm font-semibold">{step.title}</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          {step.description}
        </p>

        {/* Progress dots */}
        <div className="mb-3 flex items-center justify-center gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                i === currentStep
                  ? "bg-primary"
                  : i < currentStep
                    ? "bg-primary/40"
                    : "bg-muted-foreground/20"
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={skipTour}
            className="text-xs"
          >
            Skip
          </Button>
          <div className="flex gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={prevStep}>
                Back
              </Button>
            )}
            <Button size="sm" onClick={() => nextStep(steps.length)}>
              {isLast ? "Done" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
