"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

type Strength = "weak" | "medium" | "strong";

function getStrength(password: string): { level: Strength; score: number } {
  if (!password) return { level: "weak", score: 0 };

  let score = 0;

  // Length
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;

  // Character variety
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

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
}

export function PasswordStrength({ password, className }: PasswordStrengthProps) {
  const { level } = useMemo(() => getStrength(password), [password]);
  const config = strengthConfig[level];

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
      </p>
    </div>
  );
}
