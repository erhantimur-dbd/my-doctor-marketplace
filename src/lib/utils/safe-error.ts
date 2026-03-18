/**
 * Sanitize error messages for client-facing responses.
 *
 * Strips database column names, SQL snippets, Stripe internal codes,
 * and stack traces. Returns a generic message for unrecognized errors.
 *
 * Use in server actions: `return { error: safeError(err) }`
 */

const SAFE_PATTERNS: [RegExp, string][] = [
  // Supabase auth
  [/invalid login credentials/i, "Invalid email or password."],
  [/email not confirmed/i, "Please verify your email before signing in."],
  [/user already registered/i, "An account with this email already exists."],
  [/email rate limit exceeded/i, "Too many requests. Please try again later."],
  [/password should be at least/i, "Password does not meet minimum requirements."],
  // Supabase DB
  [/duplicate key.*unique/i, "This record already exists."],
  [/violates foreign key/i, "A referenced record was not found."],
  [/violates check constraint/i, "Invalid data provided."],
  [/row-level security/i, "You do not have permission to perform this action."],
  [/new row violates/i, "Invalid data provided."],
  // Stripe
  [/no such (customer|payment_intent|price|subscription)/i, "Payment record not found. Please try again."],
  [/card was declined/i, "Your card was declined. Please try a different payment method."],
  [/expired card/i, "Your card has expired."],
  [/insufficient funds/i, "Insufficient funds. Please try a different card."],
  [/stripe.*rate limit/i, "Payment service busy. Please try again in a moment."],
  // Network
  [/fetch failed|ECONNREFUSED|ETIMEDOUT/i, "Service temporarily unavailable. Please try again."],
];

const GENERIC_ERROR = "An unexpected error occurred. Please try again.";

export function safeError(err: unknown): string {
  if (!err) return GENERIC_ERROR;

  const message = typeof err === "string"
    ? err
    : err instanceof Error
      ? err.message
      : typeof (err as any)?.message === "string"
        ? (err as any).message
        : GENERIC_ERROR;

  // Check known safe patterns
  for (const [pattern, safe] of SAFE_PATTERNS) {
    if (pattern.test(message)) return safe;
  }

  // If it looks like a user-facing message (no SQL, no stack), pass through
  if (
    message.length < 200 &&
    !/\b(column|table|relation|constraint|violates|pg_|sql|SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b/i.test(message) &&
    !/at\s+\w+\s+\(/.test(message) // stack trace
  ) {
    return message;
  }

  return GENERIC_ERROR;
}

/**
 * Log the real error server-side, return the safe version.
 * Usage: `return { error: logAndSanitize("createBooking", err) }`
 */
export function logAndSanitize(context: string, err: unknown): string {
  console.error(`[${context}]`, err);
  return safeError(err);
}
