"use client";

import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export function BackToSearchButton() {
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2 mb-4"
      onClick={() => router.back()}
    >
      <ArrowLeft className="h-4 w-4" />
      Return to search
    </Button>
  );
}
