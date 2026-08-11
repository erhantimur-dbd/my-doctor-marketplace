import { z } from "zod/v4";

/**
 * Shared password rules for client + server.
 * - Minimum 8 characters
 * - At least 3 of: lowercase, uppercase, digit, special char
 */
export function passwordVarietyScore(password: string): number {
  let score = 0;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return score;
}

/** True when password would pass passwordSchema (use on client before submit). */
export function passwordMeetsServerMinimum(password: string): boolean {
  return password.length >= 8 && passwordVarietyScore(password) >= 3;
}

/**
 * Server-side password strength validation.
 * Mirrors the client-side scoring in password-strength.tsx
 * but enforces a minimum score of 3 (Medium).
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine((pw) => passwordVarietyScore(pw) >= 3, {
    message:
      "Password must contain at least 3 of: lowercase letter, uppercase letter, digit, special character",
  });
