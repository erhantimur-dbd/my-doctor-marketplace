"use client";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, GitCompareArrows } from "lucide-react";
import { useDoctorCompare } from "@/hooks/use-doctor-compare";

export function CompareTray() {
  const {
    compareList,
    removeFromCompare,
    clearCompare,
    setCompareOpen,
  } = useDoctorCompare();

  if (compareList.length === 0) return null;

  return (
    <>
      {/* Spacer to prevent content from hiding behind fixed tray */}
      <div className="h-[120px] md:h-[64px]" />

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        {/* Desktop: single row */}
        <div className="container mx-auto hidden md:flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">
              Compare ({compareList.length}/3)
            </span>
            <div className="flex items-center gap-2">
              {compareList.map((doctor) => (
                <div
                  key={doctor.id}
                  className="flex items-center gap-1.5 rounded-full border bg-card pl-1 pr-2 py-1"
                >
                  <Avatar className="h-6 w-6">
                    {doctor.avatarUrl && (
                      <AvatarImage src={doctor.avatarUrl} alt={doctor.name} />
                    )}
                    <AvatarFallback className="text-[10px]">
                      {doctor.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-24 truncate text-xs font-medium">
                    {doctor.name}
                  </span>
                  <button
                    onClick={() => removeFromCompare(doctor.id)}
                    className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label={`Remove ${doctor.name} from comparison`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearCompare}>
              Clear
            </Button>
            <Button
              size="sm"
              onClick={() => setCompareOpen(true)}
              disabled={compareList.length < 2}
            >
              <GitCompareArrows className="mr-1.5 h-4 w-4" />
              Compare
            </Button>
          </div>
        </div>

        {/* Mobile: stacked two-row layout */}
        <div className="md:hidden px-3 py-2.5">
          {/* Row 1: Label + doctor chips */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              Compare ({compareList.length}/3)
            </span>
            {compareList.map((doctor) => (
              <div
                key={doctor.id}
                className="flex shrink-0 items-center gap-1 rounded-full border bg-card pl-1 pr-1.5 py-0.5"
              >
                <Avatar className="h-5 w-5">
                  {doctor.avatarUrl && (
                    <AvatarImage src={doctor.avatarUrl} alt={doctor.name} />
                  )}
                  <AvatarFallback className="text-[9px]">
                    {doctor.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-[5.5rem] truncate text-[11px] font-medium">
                  {doctor.name}
                </span>
                <button
                  onClick={() => removeFromCompare(doctor.id)}
                  className="rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Remove ${doctor.name} from comparison`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
          {/* Row 2: Action buttons — full width */}
          <div className="mt-2 flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearCompare}
              className="h-8 flex-1 text-xs"
            >
              Clear
            </Button>
            <Button
              size="sm"
              onClick={() => setCompareOpen(true)}
              disabled={compareList.length < 2}
              className="h-8 flex-1 text-xs"
            >
              <GitCompareArrows className="mr-1 h-3.5 w-3.5" />
              Compare
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
