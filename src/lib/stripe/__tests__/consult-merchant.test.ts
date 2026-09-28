import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONSULT_PAYMENT_METHOD_TYPES,
  DOCTOR_CARD_PAYMENTS_UNAVAILABLE_MESSAGE,
  EXPRESS_CONNECT_CAPABILITIES,
  cardPaymentsCapabilityStatus,
  doctorCanAcceptConsultCardPayment,
  isCardPaymentsCapabilityActive,
  requestCardPaymentsIfNeeded,
} from "@/lib/stripe/consult-merchant";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

/** Argument text of each `callee(` call, with strings and template braces ignored. */
function callArgs(src: string, callee: string): string[] {
  const args: string[] = [];
  let from = 0;
  while (from < src.length) {
    const at = src.indexOf(callee, from);
    if (at < 0) break;
    const paren = src.indexOf("(", at + callee.length);
    if (paren < 0) break;
    if (paren - (at + callee.length) > 5) {
      from = at + callee.length;
      continue;
    }
    args.push(sliceBalanced(src, paren));
    from = paren + 1;
  }
  return args;
}

function sliceBalanced(src: string, openIndex: number): string {
  const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
  const openCh = src[openIndex];
  const closeCh = pairs[openCh];
  let depth = 0;
  let i = openIndex;
  let quote: "'" | '"' | "`" | null = null;
  while (i < src.length) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (quote === "`" && ch === "$" && src[i + 1] === "{") {
        const inner = sliceBalanced(src, i + 1);
        i += 2 + inner.length;
        continue;
      }
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === "/" && src[i + 1] === "/") {
      const nl = src.indexOf("\n", i);
      i = nl < 0 ? src.length : nl + 1;
      continue;
    }
    if (ch === openCh) depth += 1;
    if (ch === closeCh) {
      depth -= 1;
      if (depth === 0) return src.slice(openIndex + 1, i);
    }
    i += 1;
  }
  throw new Error(`unbalanced ${openCh} at ${openIndex}`);
}

function enclosingFunction(src: string, index: number): string {
  const matches = [...src.slice(0, index).matchAll(/export async function (\w+)/g)];
  return matches.at(-1)?.[1] ?? "";
}

function stripeWith(status: string | null | undefined, onUpdate?: () => void) {
  const calls: { update: number } = { update: 0 };
  const stripe = {
    accounts: {
      async retrieve() {
        return {
          capabilities:
            status === undefined ? undefined : { card_payments: status },
        };
      },
      async update() {
        calls.update += 1;
        onUpdate?.();
        return { capabilities: { card_payments: "pending" } };
      },
    },
  };
  return { stripe, calls };
}

describe("card payments capability", () => {
  it("treats only active as able to take a consult card charge", () => {
    expect(isCardPaymentsCapabilityActive({ card_payments: "active" })).toBe(
      true
    );
    expect(isCardPaymentsCapabilityActive({ card_payments: "pending" })).toBe(
      false
    );
    expect(isCardPaymentsCapabilityActive({ card_payments: "inactive" })).toBe(
      false
    );
    expect(isCardPaymentsCapabilityActive(null)).toBe(false);
    expect(cardPaymentsCapabilityStatus(undefined)).toBe("unknown");
  });

  it("blocks checkout when card_payments is not active", async () => {
    for (const status of ["pending", "inactive", null, undefined] as const) {
      const { stripe } = stripeWith(status);
      const result = await doctorCanAcceptConsultCardPayment(
        stripe,
        "acct_test"
      );
      expect(result).toEqual({
        ok: false,
        error: DOCTOR_CARD_PAYMENTS_UNAVAILABLE_MESSAGE,
      });
    }
  });

  it("allows checkout when card_payments is active", async () => {
    const { stripe } = stripeWith("active");
    await expect(
      doctorCanAcceptConsultCardPayment(stripe, "acct_test")
    ).resolves.toEqual({ ok: true });
  });

  it("fails closed when Stripe cannot be read", async () => {
    const stripe = {
      accounts: {
        async retrieve() {
          throw new Error("stripe down");
        },
        async update() {
          return { capabilities: { card_payments: "active" } };
        },
      },
    };
    const result = await doctorCanAcceptConsultCardPayment(stripe, "acct_test");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(DOCTOR_CARD_PAYMENTS_UNAVAILABLE_MESSAGE);
    }
  });

  it("requests card_payments only when it is not already active or pending", async () => {
    const active = stripeWith("active");
    await expect(
      requestCardPaymentsIfNeeded(active.stripe, "acct_test")
    ).resolves.toBe("active");
    expect(active.calls.update).toBe(0);

    const pending = stripeWith("pending");
    await expect(
      requestCardPaymentsIfNeeded(pending.stripe, "acct_test")
    ).resolves.toBe("pending");
    expect(pending.calls.update).toBe(0);

    const inactive = stripeWith("inactive");
    await expect(
      requestCardPaymentsIfNeeded(inactive.stripe, "acct_test")
    ).resolves.toBe("pending");
    expect(inactive.calls.update).toBe(1);

    const missing = stripeWith(undefined);
    await requestCardPaymentsIfNeeded(missing.stripe, "acct_test");
    expect(missing.calls.update).toBe(1);
  });

  it("requests card_payments and transfers on new Express accounts", () => {
    expect(EXPRESS_CONNECT_CAPABILITIES.card_payments).toEqual({
      requested: true,
    });
    expect(EXPRESS_CONNECT_CAPABILITIES.transfers).toEqual({
      requested: true,
    });
  });
});
