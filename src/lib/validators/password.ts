import { z } from "zod/v4";

/**
 * Server-side password strength validation.
 * Mirrors the client-side scoring in password-strength.tsx
 * but enforces a minimum score of 3 (Medium).
 *
 * Rules:
 * - Minimum 8 characters
 * - At least 3 of: lowercase, uppercase, digit, special char
 */
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .refine(
    (pw) => {
      let score = 0;
      if (/[a-z]/.test(pw)) score++;
      if (/[A-Z]/.test(pw)) score++;
      if (/[0-9]/.test(pw)) score++;
      if (/[^a-zA-Z0-9]/.test(pw)) score++;
      return score >= 3;
    },
    {
      message:
        "Password must contain at least 3 of: lowercase letter, uppercase letter, digit, special character",
    }
  );
