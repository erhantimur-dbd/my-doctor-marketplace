"use client";

import { useSessionTimeout } from "@/hooks/use-session-timeout";

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;

export function DoctorSessionGuard() {
  useSessionTimeout(FIFTEEN_MINUTES);
  return null;
}

export function PatientSessionGuard() {
  useSessionTimeout(THIRTY_MINUTES);
  return null;
}

export function AdminSessionGuard() {
  useSessionTimeout(FIFTEEN_MINUTES);
  return null;
}
