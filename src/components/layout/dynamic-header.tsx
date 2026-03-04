"use client";

import dynamic from "next/dynamic";

/**
 * Client-only Header — prevents Radix UI hydration ID mismatches.
 *
 * Radix primitives (DropdownMenu, Sheet) generate random IDs that differ
 * between server and client rendering, producing noisy console warnings.
 * By loading the Header only on the client, the IDs are generated once
 * and the warnings disappear entirely.
 */
const DynamicHeader = dynamic(
  () => import("./header").then((mod) => ({ default: mod.Header })),
  {
    ssr: false,
    loading: () => (
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center" />
      </header>
    ),
  }
);

export { DynamicHeader as Header };
