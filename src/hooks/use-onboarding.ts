"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY_PREFIX = "onboarding_completed_";

/**
 * Track onboarding tour completion state per tour ID in localStorage.
 */
export function useOnboarding(tourId: string) {
  const [isCompleted, setIsCompleted] = useState(true); // default true to avoid flash
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PREFIX + tourId);
      if (stored === "true") {
        setIsCompleted(true);
        setIsActive(false);
      } else {
        setIsCompleted(false);
        // Auto-start the tour for first-time users
        setIsActive(true);
      }
    } catch {
      setIsCompleted(true);
    }
  }, [tourId]);

  const completeTour = useCallback(() => {
    setIsCompleted(true);
    setIsActive(false);
    setCurrentStep(0);
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + tourId, "true");
    } catch {
      // Storage full — ignore
    }
  }, [tourId]);

  const resetTour = useCallback(() => {
    setIsCompleted(false);
    setCurrentStep(0);
    setIsActive(true);
    try {
      localStorage.removeItem(STORAGE_KEY_PREFIX + tourId);
    } catch {
      // Ignore
    }
  }, [tourId]);

  const nextStep = useCallback(
    (totalSteps: number) => {
      if (currentStep < totalSteps - 1) {
        setCurrentStep((prev) => prev + 1);
      } else {
        completeTour();
      }
    },
    [currentStep, completeTour]
  );

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  }, []);

  const skipTour = useCallback(() => {
    completeTour();
  }, [completeTour]);

  return {
    isCompleted,
    isActive,
    currentStep,
    setCurrentStep,
    nextStep,
    prevStep,
    completeTour,
    resetTour,
    skipTour,
  };
}
