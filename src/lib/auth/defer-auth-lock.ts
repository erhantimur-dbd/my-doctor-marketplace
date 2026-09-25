/**
 * GoTrue awaits `onAuthStateChange` listeners while `initialize()` still
 * holds the auth lock (`_recoverAndRefresh` → `_notifyAllSubscribers`).
 * `getSession()` waits on that same `initializePromise`. Awaiting a
 * `supabase.from()` call inside the listener never settles, so every later
 * browser query (subscription gate, bookings list) stays pending and the
 * panel spinner never leaves. The header still shows the server session.
 *
 * A macrotask runs only after the listener returns and the lock is released.
 * `queueMicrotask` is not enough: it flushes before `await listener()` resumes.
 */
export function deferUntilAuthLockReleased(work: () => void): void {
  setTimeout(work, 0);
}
