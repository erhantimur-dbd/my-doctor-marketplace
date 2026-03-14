"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Repeat, CalendarDays } from "lucide-react";

interface RecurringOptionProps {
  selectedDate: string; // "YYYY-MM-DD"
  onRecurringChange: (config: RecurringConfig | null) => void;
}

export interface RecurringConfig {
  pattern: "weekly" | "biweekly";
  numWeeks: number;
  dates: string[];
}

export function RecurringOption({
  selectedDate,
  onRecurringChange,
}: RecurringOptionProps) {
  const [enabled, setEnabled] = useState(false);
  const [pattern, setPattern] = useState<"weekly" | "biweekly">("weekly");
  const [numWeeks, setNumWeeks] = useState(4);

  function computeDates(
    baseDate: string,
    pat: "weekly" | "biweekly",
    weeks: number
  ): string[] {
    const interval = pat === "weekly" ? 7 : 14;
    const dates: string[] = [];
    const start = new Date(baseDate + "T00:00:00");

    for (let i = 0; i < weeks; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i * interval);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  }

  function handleToggle(value: boolean) {
    setEnabled(value);
    if (value) {
      const dates = computeDates(selectedDate, pattern, numWeeks);
      onRecurringChange({ pattern, numWeeks, dates });
    } else {
      onRecurringChange(null);
    }
  }

  function handlePatternChange(value: "weekly" | "biweekly") {
    setPattern(value);
    if (enabled) {
      const dates = computeDates(selectedDate, value, numWeeks);
      onRecurringChange({ pattern: value, numWeeks, dates });
    }
  }

  function handleWeeksChange(value: string) {
    const weeks = parseInt(value, 10);
    setNumWeeks(weeks);
    if (enabled) {
      const dates = computeDates(selectedDate, pattern, weeks);
      onRecurringChange({ pattern, numWeeks: weeks, dates });
    }
  }

  const previewDates = enabled
    ? computeDates(selectedDate, pattern, numWeeks)
    : [];

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="recurring-toggle" className="font-medium">
            Make this a recurring appointment
          </Label>
        </div>
        <Switch
          id="recurring-toggle"
          checked={enabled}
          onCheckedChange={handleToggle}
        />
      </div>

      {enabled && (
        <div className="space-y-4 pl-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-sm text-muted-foreground">Frequency</Label>
              <Select value={pattern} onValueChange={handlePatternChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Every week</SelectItem>
                  <SelectItem value="biweekly">Every 2 weeks</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">
                Number of sessions
              </Label>
              <Select
                value={String(numWeeks)}
                onValueChange={handleWeeksChange}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} sessions
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview scheduled dates */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Scheduled dates
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {previewDates.map((date, i) => (
                <Badge key={date} variant={i === 0 ? "default" : "secondary"} className="text-xs">
                  {new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
