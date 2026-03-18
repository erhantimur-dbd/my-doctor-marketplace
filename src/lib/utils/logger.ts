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
      data: sanitizeData(entry.data),
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

/** Strip sensitive patterns from log data */
function sanitizeData(
  data?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const sanitized: Record<string, unknown> = {};
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

  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.some((sk) => key.toLowerCase().includes(sk))) {
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
