"use client";

import { useRef } from "react";

export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus = false,
  size = "md",
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  size?: "md" | "lg";
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || "");
  const boxClass =
    size === "lg"
      ? "h-14 w-11 sm:w-12 text-2xl"
      : "h-12 w-10 text-xl";

  function applyValue(next: string) {
    const sanitized = next.replace(/\D/g, "").slice(0, 6);
    onChange(sanitized);
    const focusIndex = Math.min(sanitized.length, 5);
    inputRefs.current[focusIndex]?.focus();
    if (sanitized.length === 6 && onComplete) {
      setTimeout(onComplete, 50);
    }
  }

  function handleChange(index: number, char: string) {
    const sanitized = char.replace(/\D/g, "");
    if (!sanitized) return;
    const newDigits = [...digits];
    if (sanitized.length > 1) {
      applyValue(sanitized);
      return;
    }
    newDigits[index] = sanitized[0];
    applyValue(newDigits.join(""));
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const newDigits = [...digits];
      if (digits[index]) {
        newDigits[index] = "";
        onChange(newDigits.join(""));
      } else if (index > 0) {
        newDigits[index - 1] = "";
        onChange(newDigits.join(""));
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "Enter" && value.length === 6 && onComplete) {
      onComplete();
    } else if (e.key === "ArrowLeft" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    applyValue(e.clipboardData.getData("text"));
  }

  return (
    <div className="flex justify-center gap-2 sm:gap-3" role="group" aria-label="Verification code">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            inputRefs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          className={`${boxClass} rounded-lg border-2 border-input bg-background text-center font-mono font-semibold transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50`}
          aria-label={`Digit ${i + 1}`}
        />
      ))}
    </div>
  );
}
