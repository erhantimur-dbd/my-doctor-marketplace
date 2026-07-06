"use client";

import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const KNOWN_HOSTS = [
  "lh3.googleusercontent.com",
  "platform-lookaside.fbsbx.com",
  "www.paypalobjects.com",
  "randomuser.me",
];

// Only hosts whitelisted in next.config remotePatterns can be optimized;
// anything else must fall back to unoptimized so it can never crash the page.
export function isKnownAvatarHost(src: string): boolean {
  try {
    const { hostname } = new URL(src);
    return hostname.endsWith(".supabase.co") || KNOWN_HOSTS.includes(hostname);
  } catch {
    return false;
  }
}

interface OptimizedAvatarProps {
  src?: string | null;
  alt: string;
  sizes: string;
  className?: string;
  fallback: React.ReactNode;
}

export function OptimizedAvatar({
  src,
  alt,
  sizes,
  className,
  fallback,
}: OptimizedAvatarProps) {
  const [errored, setErrored] = React.useState(false);
  const showImage = Boolean(src) && !errored;

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        className
      )}
    >
      {showImage ? (
        <Image
          src={src as string}
          alt={alt}
          fill
          sizes={sizes}
          className="object-cover"
          onError={() => setErrored(true)}
          unoptimized={!isKnownAvatarHost(src as string)}
        />
      ) : (
        fallback
      )}
    </div>
  );
}
