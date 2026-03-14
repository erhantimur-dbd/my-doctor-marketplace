"use client";

import { type ReactNode } from "react";
import { Confetti } from "./confetti";
import {
  PageTransition,
  ScaleIn,
  StaggerContainer,
  StaggerItem,
} from "./page-transition";

/**
 * Wraps the booking confirmation page with confetti + staggered entrance.
 */
export function BookingSuccessAnimation({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <Confetti count={60} duration={3.5} />
      <PageTransition>{children}</PageTransition>
    </>
  );
}

/**
 * Animated success icon — scales in with a spring bounce.
 */
export function AnimatedSuccessIcon({
  children,
}: {
  children: ReactNode;
}) {
  return <ScaleIn delay={0.2}>{children}</ScaleIn>;
}
