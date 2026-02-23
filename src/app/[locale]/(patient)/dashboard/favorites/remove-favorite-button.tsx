"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { removeFavorite } from "./actions";

interface RemoveFavoriteButtonProps {
  favoriteId: string;
}

export function RemoveFavoriteButton({
  favoriteId,
}: RemoveFavoriteButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleRemove() {
    startTransition(async () => {
      const result = await removeFavorite(favoriteId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Doctor removed from saved list.");
      router.refresh();
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
      onClick={handleRemove}
      disabled={isPending}
      title="Remove from saved"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Heart className="h-4 w-4 fill-current" />
      )}
    </Button>
  );
}
