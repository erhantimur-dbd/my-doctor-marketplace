"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

const PRESETS = [
  { label: "7d", value: "7" },
  { label: "30d", value: "30" },
  { label: "90d", value: "90" },
  { label: "6m", value: "180" },
  { label: "12m", value: "365" },
] as const;

export function DateRangeSelector() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentRange = searchParams.get("range") || "365";

  function setRange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "365") {
      params.delete("range");
    } else {
      params.set("range", value);
    }
    router.push(`?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1">
      {PRESETS.map((p) => (
        <Button
          key={p.value}
          variant={currentRange === p.value ? "default" : "outline"}
          size="sm"
          className="h-7 px-2.5 text-xs"
          onClick={() => setRange(p.value)}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
