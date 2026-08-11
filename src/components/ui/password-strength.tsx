"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  passwordMeetsServerMinimum,
  passwordVarietyScore,
} from "@/lib/validators/password";

type Strength = "weak" | "medium" | "strong";

function getStrength(password: string): { level: Strength; score: number } {
  if (!password) return { level: "weak", score: 0 };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  score += passwordVarietyScore(password);

  if (score <= 2) return { level: "weak", score };
  if (score <= 4) return { level: "medium", score };
  return { level: "strong", score };
}

const strengthConfig: Record<
  Strength,
  { label: string; color: string; bars: number }
> = {
  weak: { label: "Weak", color: "bg-red-500", bars: 1 },
  medium: { label: "Medium", color: "bg-amber-500", bars: 2 },
  strong: { label: "Strong", color: "bg-emerald-500", bars: 3 },
};

interface PasswordStrengthProps {
  password: string;
  className?: string;
  /** Show the “what’s required” hint under the meter */
  showRequirements?: boolean;
}

export function PasswordStrength({
  password,
  className,
  showRequirements = true,
}: PasswordStrengthProps) {
  const { level } = useMemo(() => getStrength(password), [password]);
  const config = strengthConfig[level];
  const meetsMin = useMemo(
    () => passwordMeetsServerMinimum(password),
    [password]
  );

  if (!password) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex gap-1">
        {[1, 2, 3].map((bar) => (
          <div
            key={bar}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              bar <= config.bars ? config.color : "bg-muted"
            )}
          />
        ))}
      </div>
      <p
        className={cn(
          "text-xs",
          level === "weak" && "text-red-600",
          level === "medium" && "text-amber-600",
          level === "strong" && "text-emerald-600"
        )}
      >
        {config.label} password
        {!meetsMin && (
          <span className="text-muted-foreground">
            {" "}
            — keep going until it meets the requirements below
          </span>
        )}
      </p>
      {showRequirements && !meetsMin && (
        <p className="text-[11px] leading-snug text-muted-foreground">
          At least 8 characters, and 3 of: lowercase, uppercase, number, symbol.
        </p>
      )}
    </div>
  );
}

export { passwordMeetsServerMinimum };
