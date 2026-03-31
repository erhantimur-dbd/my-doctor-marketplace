export interface OnboardingStep {
  /** CSS selector for the target element to highlight */
  targetSelector: string;
  /** Title shown in the tooltip */
  title: string;
  /** Description text */
  description: string;
  /** Preferred tooltip position relative to the target */
  position: "top" | "bottom" | "left" | "right";
}

/**
 * Onboarding steps for the patient dashboard.
 */
export const patientDashboardSteps: OnboardingStep[] = [
  {
    targetSelector: '[data-tour="patient-quick-actions"]',
    title: "Quick Actions",
    description:
      "Find a doctor, manage bookings, view treatment plans, or update your settings — all just one click away.",
    position: "bottom",
  },
  {
    targetSelector: '[data-tour="patient-upcoming"]',
    title: "Upcoming Appointments",
    description:
      "Your next scheduled appointments appear here. Join video calls, view details, or manage your bookings easily.",
    position: "bottom",
  },
  {
    targetSelector: '[data-tour="patient-activity"]',
    title: "Recent Activity",
    description:
      "Stay up to date with booking confirmations, messages from doctors, and other important notifications.",
    position: "top",
  },
];

/**
 * Onboarding steps for the doctor dashboard.
 */
export const doctorDashboardSteps: OnboardingStep[] = [
  {
    targetSelector: '[data-tour="doctor-schedule"]',
    title: "Today's Schedule",
    description:
      "See your appointments for today at a glance. Join video calls directly from here when it's time.",
    position: "bottom",
  },
  {
    targetSelector: '[data-tour="doctor-bookings"]',
    title: "Manage Bookings",
    description:
      "View all your bookings, approve or decline requests, and handle reschedule requests from patients.",
    position: "right",
  },
  {
    targetSelector: '[data-tour="doctor-calendar"]',
    title: "Availability Calendar",
    description:
      "Set your available hours so patients can book appointments with you. Keep this up to date for the best results.",
    position: "right",
  },
  {
    targetSelector: '[data-tour="doctor-profile"]',
    title: "Your Profile",
    description:
      "Complete your profile with a photo, bio, education, and specialties. A complete profile attracts more patients.",
    position: "right",
  },
];
