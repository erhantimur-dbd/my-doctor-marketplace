/**
 * Structured logging utility.
 *
 * In development, logs to console with coloured prefixes.
 * In production, outputs JSON lines — ready for Vercel Log Drain,
 * Axiom, Datadog, or any JSON-based log aggregator.
 *
 * Usage:
 *   import { log } from "@/lib/utils/logger";
 *   log.info("Booking created", { bookingId, patientId });
 *   log.error("Stripe refund failed", { err, bookingId });
 *   log.warn("Rate limit hit", { ip, endpoint });
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function serialize(entry: LogEntry): string {
  if (IS_PRODUCTION) {
    return JSON.stringify({
      ...entry,
      data: sanitizeLogData(entry.data),
    });
  }
  // Dev: human-readable
  const prefix = {
    debug: "\x1b[90m[DEBUG]\x1b[0m",
    info: "\x1b[36m[INFO]\x1b[0m",
    warn: "\x1b[33m[WARN]\x1b[0m",
    error: "\x1b[31m[ERROR]\x1b[0m",
  }[entry.level];
  const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
  return `${prefix} ${entry.message}${dataStr}`;
}

const SENSITIVE_KEYS = [
  "password",
  "token",
  "secret",
  "api_key",
  "apiKey",
  "authorization",
  "cookie",
  "credit_card",
  "ssn",
  "stripe_secret",
];

/**
 * Strip secrets from log data.
 * Numeric `*Tokens` counts are kept. The substring "token" would otherwise
 * redact `inputTokens` / `outputTokens` / `totalTokens` on the AI meter.
 * A non-number under those names is still redacted.
 */
export function sanitizeLogData(
  data?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lower = key.toLowerCase();
    const tokenCount =
      typeof value === "number" &&
      Number.isFinite(value) &&
      lower.endsWith("tokens");
    if (
      !tokenCount &&
      SENSITIVE_KEYS.some((sk) => lower.includes(sk.toLowerCase()))
    ) {
      sanitized[key] = "[REDACTED]";
    } else if (value instanceof Error) {
      sanitized[key] = {
        name: value.name,
        message: value.message,
        ...(IS_PRODUCTION ? {} : { stack: value.stack }),
      };
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function emit(level: LogLevel, message: string, data?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    data,
  };
  const line = serialize(entry);

  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    case "debug":
      if (!IS_PRODUCTION) console.debug(line);
      break;
    default:
      console.log(line);
  }
}

export const log = {
  debug: (message: string, data?: Record<string, unknown>) =>
    emit("debug", message, data),
  info: (message: string, data?: Record<string, unknown>) =>
    emit("info", message, data),
  warn: (message: string, data?: Record<string, unknown>) =>
    emit("warn", message, data),
  error: (message: string, data?: Record<string, unknown>) =>
    emit("error", message, data),
};
