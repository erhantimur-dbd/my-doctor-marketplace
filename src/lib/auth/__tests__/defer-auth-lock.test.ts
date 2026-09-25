import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { deferUntilAuthLockReleased } from "@/lib/auth/defer-auth-lock";

/**
 * Model of @supabase/auth-js 2.97:
 * initialize() holds the lock and awaits listeners.
 * getSession() awaits initializePromise before it can take the lock.
 * A listener that awaits getSession never returns, so the bookings
 * queries never start and Loader2 stays up. The header already has the
 * server-rendered user.
 */
function startInitialize() {
  let resolveInit: () => void = () => {};
  const initializePromise = new Promise<void>((resolve) => {
    resolveInit = resolve;
  });
  return { initializePromise, resolveInit };
}

describe("auth listener vs GoTrue initialize lock", () => {
  it("deadlocks when the listener awaits the session read", async () => {
    const { initializePromise, resolveInit } = startInitialize();
    let notifyFinished = false;

    const notify = (async () => {
      // Same as _notifyAllSubscribers: the listener is awaited in the lock.
      await (async () => {
        await initializePromise;
      })();
      resolveInit();
      notifyFinished = true;
    })();

    const outcome = await Promise.race([
      notify.then(() => "notify" as const),
      new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), 40)
      ),
    ]);

    expect(outcome).toBe("timeout");
    expect(notifyFinished).toBe(false);
    // Unblock so the dangling initialize cannot keep the suite open.
    resolveInit();
    await notify;
  });

  it("settles when session work is deferred until the listener returns", async () => {
    const { initializePromise, resolveInit } = startInitialize();
    let sawSession = false;

    const notify = (async () => {
      deferUntilAuthLockReleased(() => {
        void initializePromise.then(() => {
          sawSession = true;
        });
      });
      resolveInit();
    })();

    await notify;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(sawSession).toBe(true);
  });

  it("AuthProvider does not await supabase inside onAuthStateChange", () => {
    const src = readFileSync(
      join(process.cwd(), "src/providers/auth-provider.tsx"),
      "utf8"
    );
    const start = src.indexOf("supabase.auth.onAuthStateChange");
    const end = src.indexOf("subscription.unsubscribe()");
    const callback = src.slice(start, end);
    expect(callback).toContain("INITIAL_SESSION");
    expect(callback).toContain("deferUntilAuthLockReleased");
    expect(callback).not.toMatch(/onAuthStateChange\(\s*async/);
    const beforeDefer = callback.slice(
      0,
      callback.indexOf("deferUntilAuthLockReleased")
    );
    expect(beforeDefer).not.toMatch(/await supabase/);
  });
});
