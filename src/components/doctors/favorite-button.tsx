"use client";

import { useState, useEffect, useTransition } from "react";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { toggleFavorite, checkIsFavorited } from "@/actions/reviews";
import { useUser } from "@/hooks/use-user";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  doctorId: string;
  /** Render variant: "hero" for the profile page hero (white on translucent), "card" for doctor cards */
  variant?: "hero" | "card";
}

export function FavoriteButton({ doctorId, variant = "hero" }: FavoriteButtonProps) {
  const { user, loading: userLoading } = useUser();
  const [favorited, setFavorited] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isPatient = user?.user_metadata?.role === "patient";

  // Check initial favourited state on mount (only if logged-in patient)
  useEffect(() => {
    if (userLoading) return;
    if (!user || !isPatient) {
      setLoaded(true);
      return;
    }

    checkIsFavorited(doctorId).then((result) => {
      setFavorited(result);
      setLoaded(true);
    });
  }, [doctorId, user, userLoading, isPatient]);

  function handleToggle(e?: React.MouseEvent) {
    // Prevent navigation when inside a Link (e.g. doctor card)
    e?.stopPropagation();
    e?.preventDefault();
    if (!user) {
      toast.error("Log in to save doctors", {
        action: {
          label: "Log in",
          onClick: () => {
            window.location.href = "/login";
          },
        },
      });
      return;
    }

    startTransition(async () => {
      const result = await toggleFavorite(doctorId);
      if (result.error) {
        toast.error(result.error);
      } else if (result.favorited) {
        setFavorited(true);
        toast.success("Doctor saved to favourites");
      } else {
        setFavorited(false);
        toast.success("Doctor removed from favourites");
      }
    });
  }

  // Don't render until we know auth + favourite state
  if (!loaded) {
    if (variant === "hero") {
      return (
        <button
          type="button"
          disabled
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/50"
          aria-label="Loading"
        >
          <Loader2 className="h-5 w-5 animate-spin" />
        </button>
      );
    }
    return null;
  }

  // Only show for logged-in patients (not doctors or admins)
  if (!user || !isPatient) return null;

  if (variant === "hero") {
    return (
      <button
        type="button"
        onClick={(e) => handleToggle(e)}
        disabled={isPending}
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full transition-all",
          favorited
            ? "bg-white/20 text-red-400 hover:bg-white/30"
            : "bg-white/10 text-white hover:bg-white/20"
        )}
        aria-label={favorited ? "Remove from favourites" : "Save to favourites"}
      >
        {isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Heart
            className={cn(
              "h-5 w-5 transition-all",
              favorited && "fill-red-400 text-red-400"
            )}
          />
        )}
      </button>
    );
  }

  // Card variant
  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={isPending}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full transition-all",
        favorited
          ? "bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50"
          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
      )}
      aria-label={favorited ? "Remove from favourites" : "Save to favourites"}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart
          className={cn(
            "h-4 w-4 transition-all",
            favorited && "fill-red-500 text-red-500"
          )}
        />
      )}
    </button>
  );
}
