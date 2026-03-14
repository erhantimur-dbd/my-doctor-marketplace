"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutGrid, Trash2 } from "lucide-react";

interface Schedule {
  id: string;
  doctor_id: string;
  day_of_week: number; // 1=Mon..7=Sun
  start_time: string; // "HH:mm:ss"
  end_time: string;
  slot_duration_minutes: number;
  consultation_type: string;
  is_active: boolean;
}

interface VisualCalendarProps {
  schedules: Schedule[];
  onAddSchedule: (data: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    slot_duration_minutes: number;
    consultation_type: string;
  }) => Promise<void>;
  onDeleteSchedule: (id: string) => Promise<void>;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 07:00 to 20:00
const HOUR_HEIGHT = 60; // px per hour
const CONSULTATION_COLORS: Record<string, string> = {
  in_person: "bg-blue-500/80 border-blue-600 text-white",
  video: "bg-green-500/80 border-green-600 text-white",
  both: "bg-purple-500/80 border-purple-600 text-white",
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function minutesToY(minutes: number): number {
  return ((minutes - 7 * 60) / 60) * HOUR_HEIGHT;
}

export function VisualCalendar({
  schedules,
  onAddSchedule,
  onDeleteSchedule,
}: VisualCalendarProps) {
  const [dragStart, setDragStart] = useState<{
    day: number;
    y: number;
  } | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newBlock, setNewBlock] = useState<{
    day: number;
    startTime: string;
    endTime: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    slot_duration_minutes: "30",
    consultation_type: "in_person",
  });
  const [saving, setSaving] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const activeSchedules = useMemo(
    () => schedules.filter((s) => s.is_active),
    [schedules]
  );

  const getRelativeY = useCallback(
    (clientY: number) => {
      if (!gridRef.current) return 0;
      const rect = gridRef.current.getBoundingClientRect();
      return Math.max(0, clientY - rect.top);
    },
    []
  );

  // Snap Y to 15-min intervals
  const snapToGrid = useCallback((y: number): number => {
    const interval = HOUR_HEIGHT / 4; // 15 min
    return Math.round(y / interval) * interval;
  }, []);

  const yToMinutes = useCallback((y: number): number => {
    return Math.round(y / HOUR_HEIGHT) * 60 + 7 * 60;
  }, []);

  const yToTime = useCallback(
    (y: number): string => {
      const snappedY = snapToGrid(y);
      const totalMinutes = (snappedY / HOUR_HEIGHT) * 60 + 7 * 60;
      return minutesToTime(Math.min(Math.max(totalMinutes, 7 * 60), 21 * 60));
    },
    [snapToGrid]
  );

  function handleMouseDown(day: number, e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-schedule-block]")) return;
    const y = getRelativeY(e.clientY);
    setDragStart({ day, y: snapToGrid(y) });
    setDragEnd(snapToGrid(y));
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragStart) return;
    const y = getRelativeY(e.clientY);
    setDragEnd(snapToGrid(y));
  }

  function handleMouseUp() {
    if (!dragStart || dragEnd === null) {
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    const startY = Math.min(dragStart.y, dragEnd);
    const endY = Math.max(dragStart.y, dragEnd);

    // Require at least 30 min block
    if (endY - startY < HOUR_HEIGHT / 2) {
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    const startTime = yToTime(startY);
    const endTime = yToTime(endY);

    setNewBlock({
      day: dragStart.day,
      startTime,
      endTime,
    });
    setDialogOpen(true);
    setDragStart(null);
    setDragEnd(null);
  }

  async function handleSave() {
    if (!newBlock) return;
    setSaving(true);
    try {
      await onAddSchedule({
        day_of_week: newBlock.day,
        start_time: newBlock.startTime,
        end_time: newBlock.endTime,
        slot_duration_minutes: Number(formData.slot_duration_minutes),
        consultation_type: formData.consultation_type,
      });
      setDialogOpen(false);
      setNewBlock(null);
    } finally {
      setSaving(false);
    }
  }

  const totalHeight = HOURS.length * HOUR_HEIGHT;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5" />
          Visual Weekly Schedule
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Drag on the grid to create availability blocks
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Day Headers */}
          <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b">
            <div />
            {DAYS.map((day, i) => (
              <div
                key={day}
                className="border-l px-2 py-2 text-center text-sm font-medium"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Time Grid */}
          <div
            ref={gridRef}
            className="relative grid grid-cols-[60px_repeat(7,1fr)]"
            style={{ height: totalHeight }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              setDragStart(null);
              setDragEnd(null);
            }}
          >
            {/* Hour labels */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="absolute left-0 w-[60px] text-right pr-2 text-xs text-muted-foreground"
                style={{ top: (hour - 7) * HOUR_HEIGHT - 8 }}
              >
                {hour.toString().padStart(2, "0")}:00
              </div>
            ))}

            {/* Horizontal grid lines */}
            {HOURS.map((hour) => (
              <div
                key={`line-${hour}`}
                className="absolute left-[60px] right-0 border-t border-dashed border-muted"
                style={{ top: (hour - 7) * HOUR_HEIGHT }}
              />
            ))}

            {/* Day columns */}
            {DAYS.map((_, dayIdx) => {
              const dayNumber = dayIdx + 1;
              const daySchedules = activeSchedules.filter(
                (s) => s.day_of_week === dayNumber
              );

              return (
                <div
                  key={dayIdx}
                  className="absolute border-l cursor-crosshair"
                  style={{
                    left: `calc(60px + ${(dayIdx / 7) * 100}% * (7/7))`,
                    width: `calc((100% - 60px) / 7)`,
                    height: totalHeight,
                    top: 0,
                  }}
                  onMouseDown={(e) => handleMouseDown(dayNumber, e)}
                >
                  {/* Existing schedule blocks */}
                  {daySchedules.map((schedule) => {
                    const startMin = timeToMinutes(schedule.start_time);
                    const endMin = timeToMinutes(schedule.end_time);
                    const top = minutesToY(startMin);
                    const height = minutesToY(endMin) - top;
                    const colorClass =
                      CONSULTATION_COLORS[schedule.consultation_type] ||
                      CONSULTATION_COLORS.both;

                    return (
                      <div
                        key={schedule.id}
                        data-schedule-block
                        className={`absolute left-1 right-1 rounded-md border px-1.5 py-1 text-[11px] leading-tight shadow-sm group cursor-default ${colorClass}`}
                        style={{ top, height: Math.max(height, 20) }}
                      >
                        <div className="font-medium truncate">
                          {schedule.start_time.slice(0, 5)} –{" "}
                          {schedule.end_time.slice(0, 5)}
                        </div>
                        {height > 30 && (
                          <div className="truncate opacity-80">
                            {schedule.consultation_type === "in_person"
                              ? "In-Person"
                              : schedule.consultation_type === "video"
                                ? "Video"
                                : "Both"}{" "}
                            · {schedule.slot_duration_minutes}min
                          </div>
                        )}
                        <button
                          className="absolute top-1 right-1 hidden group-hover:block rounded bg-black/20 p-0.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteSchedule(schedule.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Drag selection preview */}
                  {dragStart &&
                    dragStart.day === dayNumber &&
                    dragEnd !== null && (
                      <div
                        className="absolute left-1 right-1 rounded-md border-2 border-dashed border-primary bg-primary/10"
                        style={{
                          top: Math.min(dragStart.y, dragEnd),
                          height: Math.abs(dragEnd - dragStart.y),
                        }}
                      />
                    )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-blue-500" />
              In-Person
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-green-500" />
              Video
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-purple-500" />
              Both
            </div>
          </div>
        </div>
      </CardContent>

      {/* New Schedule Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Availability Block</DialogTitle>
          </DialogHeader>
          {newBlock && (
            <div className="space-y-4 py-4">
              <div className="rounded-md bg-muted p-3 text-sm">
                <p>
                  <span className="font-medium">Day:</span>{" "}
                  {DAYS[newBlock.day - 1]}
                </p>
                <p>
                  <span className="font-medium">Time:</span>{" "}
                  {newBlock.startTime} – {newBlock.endTime}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input
                    type="time"
                    value={newBlock.startTime}
                    onChange={(e) =>
                      setNewBlock({ ...newBlock, startTime: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input
                    type="time"
                    value={newBlock.endTime}
                    onChange={(e) =>
                      setNewBlock({ ...newBlock, endTime: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Slot Duration</Label>
                <Select
                  value={formData.slot_duration_minutes}
                  onValueChange={(v) =>
                    setFormData({ ...formData, slot_duration_minutes: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="20">20 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Consultation Type</Label>
                <Select
                  value={formData.consultation_type}
                  onValueChange={(v) =>
                    setFormData({ ...formData, consultation_type: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_person">In-Person</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Add Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
