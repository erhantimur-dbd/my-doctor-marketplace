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
      className="gap-1.5 text-white/70 hover:text-white hover:bg-white/10 -ml-2"
      onClick={() => router.back()}
    >
      <ArrowLeft className="h-4 w-4" />
      Return to search
    </Button>
  );
}
