"use client";

import { useEffect, useState, useTransition } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { SubscriptionGate } from "@/components/shared/subscription-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Clock,
  Loader2,
  AlertCircle,
} from "lucide-react";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const SLOT_DURATIONS = [
  { value: "15", label: "15 minutes" },
  { value: "20", label: "20 minutes" },
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "60 minutes" },
];

interface Schedule {
  id: string;
  doctor_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  consultation_type: string;
  is_active: boolean;
}

interface DateOverride {
  id: string;
  doctor_id: string;
  override_date: string;
  is_blocked: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

function createSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function CalendarPage() {
  return (
    <SubscriptionGate feature="Calendar & Scheduling">
      <CalendarContent />
    </SubscriptionGate>
  );
}

function CalendarContent() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [overrides, setOverrides] = useState<DateOverride[]>([]);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Schedule form state
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    day_of_week: "1",
    start_time: "09:00",
    end_time: "17:00",
    slot_duration_minutes: "30",
    consultation_type: "in_person",
  });

  // Override form state
  const [overrideDialogOpen, setOverrideDialogOpen] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    override_date: "",
    is_blocked: true,
    start_time: "",
    end_time: "",
    reason: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: doctor } = await supabase
      .from("doctors")
      .select("id")
      .eq("profile_id", user.id)
      .single();
    if (!doctor) return;

    setDoctorId(doctor.id);

    const [schedulesRes, overridesRes] = await Promise.all([
      supabase
        .from("availability_schedules")
        .select("*")
        .eq("doctor_id", doctor.id)
        .order("day_of_week"),
      supabase
        .from("availability_overrides")
        .select("*")
        .eq("doctor_id", doctor.id)
        .order("override_date", { ascending: false }),
    ]);

    setSchedules(schedulesRes.data || []);
    setOverrides(overridesRes.data || []);
    setLoading(false);
  }

  function openAddSchedule() {
    setEditingSchedule(null);
    setScheduleForm({
      day_of_week: "1",
      start_time: "09:00",
      end_time: "17:00",
      slot_duration_minutes: "30",
      consultation_type: "in_person",
    });
    setScheduleDialogOpen(true);
  }

  function openEditSchedule(schedule: Schedule) {
    setEditingSchedule(schedule);
    setScheduleForm({
      day_of_week: schedule.day_of_week.toString(),
      start_time: schedule.start_time.slice(0, 5),
      end_time: schedule.end_time.slice(0, 5),
      slot_duration_minutes: schedule.slot_duration_minutes.toString(),
      consultation_type: schedule.consultation_type,
    });
    setScheduleDialogOpen(true);
  }

  async function saveSchedule() {
    if (!doctorId) return;
    const supabase = createSupabase();

    const payload = {
      doctor_id: doctorId,
      day_of_week: parseInt(scheduleForm.day_of_week),
      start_time: scheduleForm.start_time,
      end_time: scheduleForm.end_time,
      slot_duration_minutes: parseInt(scheduleForm.slot_duration_minutes),
      consultation_type: scheduleForm.consultation_type,
      is_active: true,
    };

    if (editingSchedule) {
      await supabase
        .from("availability_schedules")
        .update(payload)
        .eq("id", editingSchedule.id);
    } else {
      await supabase.from("availability_schedules").insert(payload);
    }

    setScheduleDialogOpen(false);
    loadData();
  }

  async function deleteSchedule(id: string) {
    const supabase = createSupabase();
    await supabase.from("availability_schedules").delete().eq("id", id);
    loadData();
  }

  async function toggleSchedule(id: string, isActive: boolean) {
    const supabase = createSupabase();
    await supabase
      .from("availability_schedules")
      .update({ is_active: !isActive })
      .eq("id", id);
    loadData();
  }

  async function saveOverride() {
    if (!doctorId) return;
    const supabase = createSupabase();

    await supabase.from("availability_overrides").insert({
      doctor_id: doctorId,
      override_date: overrideForm.override_date,
      is_blocked: overrideForm.is_blocked,
      start_time: overrideForm.is_blocked ? null : overrideForm.start_time || null,
      end_time: overrideForm.is_blocked ? null : overrideForm.end_time || null,
      reason: overrideForm.reason || null,
    });

    setOverrideDialogOpen(false);
    setOverrideForm({
      override_date: "",
      is_blocked: true,
      start_time: "",
      end_time: "",
      reason: "",
    });
    loadData();
  }

  async function deleteOverride(id: string) {
    const supabase = createSupabase();
    await supabase.from("availability_overrides").delete().eq("id", id);
    loadData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Availability Calendar</h1>
          <p className="text-muted-foreground">
            Manage your weekly schedule and date overrides
          </p>
        </div>
      </div>

      {/* Weekly Schedule */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Weekly Schedule
          </CardTitle>
          <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openAddSchedule} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Schedule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingSchedule ? "Edit Schedule" : "Add Schedule"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Day of Week</Label>
                  <Select
                    value={scheduleForm.day_of_week}
                    onValueChange={(val) =>
                      setScheduleForm((prev) => ({ ...prev, day_of_week: val }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((day, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={scheduleForm.start_time}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({
                          ...prev,
                          start_time: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={scheduleForm.end_time}
                      onChange={(e) =>
                        setScheduleForm((prev) => ({
                          ...prev,
                          end_time: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Slot Duration</Label>
                  <Select
                    value={scheduleForm.slot_duration_minutes}
                    onValueChange={(val) =>
                      setScheduleForm((prev) => ({
                        ...prev,
                        slot_duration_minutes: val,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SLOT_DURATIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Consultation Type</Label>
                  <Select
                    value={scheduleForm.consultation_type}
                    onValueChange={(val) =>
                      setScheduleForm((prev) => ({
                        ...prev,
                        consultation_type: val,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_person">In Person</SelectItem>
                      <SelectItem value="video">Video</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button onClick={saveSchedule}>
                  {editingSchedule ? "Update" : "Add"} Schedule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {schedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                No schedule configured yet. Add your weekly availability to start
                receiving bookings.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Day</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead>Slot Duration</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">
                      {DAYS_OF_WEEK[schedule.day_of_week - 1]}
                    </TableCell>
                    <TableCell>{schedule.start_time.slice(0, 5)}</TableCell>
                    <TableCell>{schedule.end_time.slice(0, 5)}</TableCell>
                    <TableCell>{schedule.slot_duration_minutes} min</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {schedule.consultation_type === "in_person"
                          ? "In Person"
                          : schedule.consultation_type === "video"
                            ? "Video"
                            : "Both"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={schedule.is_active}
                        onCheckedChange={() =>
                          toggleSchedule(schedule.id, schedule.is_active)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditSchedule(schedule)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteSchedule(schedule.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Date Overrides */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Date Overrides
          </CardTitle>
          <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setOverrideForm({
                    override_date: "",
                    is_blocked: true,
                    start_time: "",
                    end_time: "",
                    reason: "",
                  });
                  setOverrideDialogOpen(true);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Override
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Date Override</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={overrideForm.override_date}
                    onChange={(e) =>
                      setOverrideForm((prev) => ({
                        ...prev,
                        override_date: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Block Entire Day</Label>
                    <p className="text-sm text-muted-foreground">
                      Mark this day as unavailable
                    </p>
                  </div>
                  <Switch
                    checked={overrideForm.is_blocked}
                    onCheckedChange={(checked) =>
                      setOverrideForm((prev) => ({
                        ...prev,
                        is_blocked: checked,
                      }))
                    }
                  />
                </div>

                {!overrideForm.is_blocked && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Custom Start Time</Label>
                      <Input
                        type="time"
                        value={overrideForm.start_time}
                        onChange={(e) =>
                          setOverrideForm((prev) => ({
                            ...prev,
                            start_time: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Custom End Time</Label>
                      <Input
                        type="time"
                        value={overrideForm.end_time}
                        onChange={(e) =>
                          setOverrideForm((prev) => ({
                            ...prev,
                            end_time: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Reason (optional)</Label>
                  <Input
                    placeholder="e.g., Holiday, Conference, Personal day"
                    value={overrideForm.reason}
                    onChange={(e) =>
                      setOverrideForm((prev) => ({
                        ...prev,
                        reason: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  onClick={saveOverride}
                  disabled={!overrideForm.override_date}
                >
                  Add Override
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {overrides.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No date overrides. Add overrides for holidays, time off, or custom
              hours on specific dates.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Custom Hours</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides.map((override) => (
                  <TableRow key={override.id}>
                    <TableCell className="font-medium">
                      {new Date(override.override_date).toLocaleDateString(
                        "en-GB",
                        {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={override.is_blocked ? "destructive" : "secondary"}
                      >
                        {override.is_blocked ? "Blocked" : "Custom Hours"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {override.is_blocked
                        ? "---"
                        : `${override.start_time?.slice(0, 5) || ""} - ${override.end_time?.slice(0, 5) || ""}`}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {override.reason || "---"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteOverride(override.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
