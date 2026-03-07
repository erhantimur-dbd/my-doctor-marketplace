"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Bell,
  Lock,
  Shield,
  Save,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  RefreshCw,
  Unlink,
  ExternalLink,
  Clock,
  Plus,
  Trash2,
} from "lucide-react";
import {
  getCalendarConnection,
  disconnectCalendar,
  triggerCalendarSync,
  toggleCalendarSync,
  getMicrosoftCalendarConnection,
  disconnectMicrosoftCalendar,
  triggerMicrosoftCalendarSync,
  toggleMicrosoftCalendarSync,
  getIcsFeedUrl,
  generateIcsFeedToken,
  revokeIcsFeedToken,
  getCalDAVConnection,
  connectCalDAV,
  disconnectCalDAV,
  triggerCalDAVSync,
  toggleCalDAVSync,
} from "@/actions/calendar";
import {
  getDoctorReminderPreferences,
  saveDoctorReminderPreferences,
  type ReminderPreference,
} from "@/actions/doctor";
import { TwoFactorSection } from "@/components/settings/two-factor-section";

const REMINDER_TIME_PRESETS = [
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" },
  { value: 240, label: "4 hours before" },
  { value: 720, label: "12 hours before" },
  { value: 1440, label: "24 hours before" },
  { value: 2880, label: "48 hours before" },
];

const DEFAULT_REMINDERS: ReminderPreference[] = [
  { minutes_before: 1440, channel: "email", is_enabled: true },
  { minutes_before: 60, channel: "email", is_enabled: true },
  { minutes_before: 60, channel: "in_app", is_enabled: true },
];

function createSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);

  // Personal info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [savedPersonal, setSavedPersonal] = useState(false);

  // Notifications
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [whatsappNotifications, setWhatsappNotifications] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [savedNotifications, setSavedNotifications] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [savedPassword, setSavedPassword] = useState(false);

  // Calendar
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(true);
  const [calendarLastSynced, setCalendarLastSynced] = useState<string | null>(null);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [disconnectingCalendar, setDisconnectingCalendar] = useState(false);

  // Microsoft Calendar
  const [msCalendarConnected, setMsCalendarConnected] = useState(false);
  const [msCalendarSyncEnabled, setMsCalendarSyncEnabled] = useState(true);
  const [msCalendarLastSynced, setMsCalendarLastSynced] = useState<string | null>(null);
  const [syncingMsCalendar, setSyncingMsCalendar] = useState(false);
  const [disconnectingMsCalendar, setDisconnectingMsCalendar] = useState(false);

  // CalDAV
  const [caldavConnected, setCaldavConnected] = useState(false);
  const [caldavSyncEnabled, setCaldavSyncEnabled] = useState(true);
  const [caldavLastSynced, setCaldavLastSynced] = useState<string | null>(null);
  const [caldavProviderName, setCaldavProviderName] = useState("");
  const [syncingCaldav, setSyncingCaldav] = useState(false);
  const [disconnectingCaldav, setDisconnectingCaldav] = useState(false);
  const [caldavDialogOpen, setCaldavDialogOpen] = useState(false);
  const [caldavProvider, setCaldavProvider] = useState("apple");
  const [caldavServerUrl, setCaldavServerUrl] = useState("");
  const [caldavUsername, setCaldavUsername] = useState("");
  const [caldavPassword, setCaldavPassword] = useState("");
  const [caldavConnecting, setCaldavConnecting] = useState(false);
  const [caldavError, setCaldavError] = useState("");

  // ICS Feed
  const [icsFeedUrl, setIcsFeedUrl] = useState<string | null>(null);
  const [generatingFeed, setGeneratingFeed] = useState(false);
  const [copiedFeed, setCopiedFeed] = useState(false);

  // Reminders
  const [reminders, setReminders] = useState<ReminderPreference[]>([]);
  const [remindersLoaded, setRemindersLoaded] = useState(false);
  const [savingReminders, setSavingReminders] = useState(false);
  const [savedReminders, setSavedReminders] = useState(false);
  const [addReminderDialogOpen, setAddReminderDialogOpen] = useState(false);
  const [newReminderMinutes, setNewReminderMinutes] = useState("60");
  const [newReminderChannel, setNewReminderChannel] = useState<"email" | "in_app">("email");

  // Account
  const [isActive, setIsActive] = useState(true);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    setUserId(user.id);
    setEmail(user.email || "");

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, phone, notification_whatsapp")
      .eq("id", user.id)
      .single();

    if (profile) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      setPhone(profile.phone || "");
      setWhatsappNotifications(profile.notification_whatsapp ?? false);
    }

    const { data: doctor } = await supabase
      .from("doctors")
      .select("id, is_active, verification_status")
      .eq("profile_id", user.id)
      .single();

    if (doctor) {
      setDoctorId(doctor.id);
      setIsActive(doctor.is_active);
      setIsVerified(doctor.verification_status === "verified");
    }

    // Load calendar connections (wrapped in try/catch to prevent infinite spinner)
    try {
      const calConn = await getCalendarConnection();
      if (calConn) {
        setCalendarConnected(true);
        setCalendarSyncEnabled(calConn.sync_enabled);
        setCalendarLastSynced(calConn.last_synced_at);
      }
    } catch (err) {
      console.error("Failed to load Google Calendar connection:", err);
    }

    try {
      const msCalConn = await getMicrosoftCalendarConnection();
      if (msCalConn) {
        setMsCalendarConnected(true);
        setMsCalendarSyncEnabled(msCalConn.sync_enabled);
        setMsCalendarLastSynced(msCalConn.last_synced_at);
      }
    } catch (err) {
      console.error("Failed to load Microsoft Calendar connection:", err);
    }

    try {
      const caldavConn = await getCalDAVConnection();
      if (caldavConn) {
        setCaldavConnected(true);
        setCaldavSyncEnabled(caldavConn.sync_enabled);
        setCaldavLastSynced(caldavConn.last_synced_at);
        setCaldavProviderName(caldavConn.caldav_provider || "CalDAV");
      }
    } catch (err) {
      console.error("Failed to load CalDAV connection:", err);
    }

    try {
      const feedResult = await getIcsFeedUrl();
      if (feedResult.url) {
        setIcsFeedUrl(feedResult.url);
      }
    } catch (err) {
      console.error("Failed to load ICS feed URL:", err);
    }

    // Check URL params for calendar connection result
    const params = new URLSearchParams(window.location.search);
    if (params.get("calendar_connected") === "true") {
      setCalendarConnected(true);
      setCalendarSyncEnabled(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("microsoft_calendar_connected") === "true") {
      setMsCalendarConnected(true);
      setMsCalendarSyncEnabled(true);
      window.history.replaceState({}, "", window.location.pathname);
    }

    try {
      const reminderResult = await getDoctorReminderPreferences();
      if (reminderResult.data) {
        setReminders(reminderResult.data.length > 0 ? reminderResult.data : DEFAULT_REMINDERS);
        setRemindersLoaded(true);
      }
    } catch (err) {
      console.error("Failed to load reminder preferences:", err);
    }

    setLoading(false);
  }

  async function savePersonalInfo() {
    if (!userId || isVerified) return;
    setSavingPersonal(true);
    setSavedPersonal(false);

    const supabase = createSupabase();
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        phone: phone || null,
      })
      .eq("id", userId);

    setSavingPersonal(false);
    if (error) {
      console.error("Save personal info failed:", error);
      alert("Failed to save. Please try again.");
      return;
    }
    setSavedPersonal(true);
    setTimeout(() => setSavedPersonal(false), 3000);
  }

  const hasValidPhone = phone?.startsWith("+") && phone.replace(/\s/g, "").length >= 8;

  async function saveNotificationPrefs() {
    if (whatsappNotifications && !hasValidPhone) {
      alert(
        "Please add your phone number with country code (e.g., +49 123 456 7890) in Personal Information to enable WhatsApp notifications."
      );
      return;
    }

    if (!userId) return;
    setSavingNotifications(true);
    setSavedNotifications(false);

    const supabase = createSupabase();
    const { error } = await supabase
      .from("profiles")
      .update({ notification_whatsapp: whatsappNotifications })
      .eq("id", userId);

    setSavingNotifications(false);
    if (error) {
      console.error("Save notification prefs failed:", error);
      alert("Failed to save. Please try again.");
      return;
    }
    setSavedNotifications(true);
    setTimeout(() => setSavedNotifications(false), 3000);
  }

  async function changePassword() {
    setPasswordError("");

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setSavingPassword(true);
    setSavedPassword(false);

    const supabase = createSupabase();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setPasswordError(error.message);
      setSavingPassword(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSavingPassword(false);
    setSavedPassword(true);
    setTimeout(() => setSavedPassword(false), 3000);
  }

  async function toggleActiveStatus() {
    if (!doctorId) return;
    setSavingAccount(true);

    const newStatus = !isActive;
    const supabase = createSupabase();
    const { error } = await supabase
      .from("doctors")
      .update({ is_active: newStatus })
      .eq("id", doctorId);

    if (error) {
      console.error("Toggle active failed:", error);
      alert("Failed to update profile status. Please try again.");
      setSavingAccount(false);
      return;
    }

    setIsActive(newStatus);
    setDeactivateDialogOpen(false);
    setSavingAccount(false);
  }

  async function saveReminders() {
    setSavingReminders(true);
    setSavedReminders(false);
    const result = await saveDoctorReminderPreferences(reminders);
    setSavingReminders(false);
    if (result.error) {
      alert("Failed to save reminders: " + result.error);
      return;
    }
    setSavedReminders(true);
    setTimeout(() => setSavedReminders(false), 3000);
  }

  function addReminder() {
    const minutes = parseInt(newReminderMinutes, 10);
    // Check for duplicate
    const exists = reminders.some(
      (r) => r.minutes_before === minutes && r.channel === newReminderChannel
    );
    if (exists) {
      alert("This reminder already exists.");
      return;
    }
    setReminders((prev) =>
      [...prev, { minutes_before: minutes, channel: newReminderChannel, is_enabled: true }]
        .sort((a, b) => b.minutes_before - a.minutes_before)
    );
    setAddReminderDialogOpen(false);
  }

  function removeReminder(index: number) {
    setReminders((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleReminder(index: number) {
    setReminders((prev) =>
      prev.map((r, i) => (i === index ? { ...r, is_enabled: !r.is_enabled } : r))
    );
  }

  function formatReminderTime(minutes: number): string {
    if (minutes < 60) return `${minutes} minutes before`;
    if (minutes === 60) return "1 hour before";
    if (minutes < 1440) return `${minutes / 60} hours before`;
    if (minutes === 1440) return "24 hours before";
    return `${minutes / 1440} days before`;
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
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Information
          </CardTitle>
          {isVerified && (
            <CardDescription className="flex items-center gap-2 text-amber-600">
              <Lock className="h-3.5 w-3.5" />
              Locked after GMC verification.{" "}
              <a href="/en/doctor-dashboard/support/new" className="underline hover:text-amber-700">
                Open a support ticket
              </a>{" "}
              to request changes.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={isVerified}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={isVerified}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} disabled />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed here. Contact support for email changes.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+49 123 456 7890"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isVerified}
              />
            </div>
          </div>
          {!isVerified && (
            <div className="flex justify-end">
              <Button onClick={savePersonalInfo} disabled={savingPersonal}>
                {savingPersonal ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : savedPersonal ? (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {savedPersonal ? "Saved" : "Save"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose how you want to be notified about new bookings, messages, and
            updates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-muted-foreground">
                Receive booking confirmations and reminders via email
              </p>
            </div>
            <Switch
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">SMS Notifications</p>
              <p className="text-sm text-muted-foreground">
                Get text messages for urgent updates and reminders
              </p>
            </div>
            <Switch
              checked={smsNotifications}
              onCheckedChange={setSmsNotifications}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">WhatsApp Notifications</p>
              <p className="text-sm text-muted-foreground">
                Receive booking confirmations and reminders via WhatsApp
              </p>
            </div>
            <Switch
              checked={whatsappNotifications}
              onCheckedChange={setWhatsappNotifications}
            />
          </div>
          {whatsappNotifications && !hasValidPhone && (
            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 dark:bg-amber-950/30">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                Please add your phone number with country code (e.g., +49 123 456 7890) in the Personal Information section above to enable WhatsApp notifications.
              </p>
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button onClick={saveNotificationPrefs} disabled={savingNotifications}>
              {savingNotifications ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : savedNotifications ? (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {savedNotifications ? "Saved" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Appointment Reminders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Appointment Reminders
          </CardTitle>
          <CardDescription>
            Configure when and how patients receive appointment reminders.
            These reminders are sent automatically before each appointment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {reminders.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Clock className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No reminders configured. Add a reminder to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {reminders.map((reminder, index) => (
                <div
                  key={`${reminder.minutes_before}-${reminder.channel}-${index}`}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={reminder.is_enabled}
                      onCheckedChange={() => toggleReminder(index)}
                    />
                    <div>
                      <p className={`text-sm font-medium ${!reminder.is_enabled ? "text-muted-foreground" : ""}`}>
                        {formatReminderTime(reminder.minutes_before)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        via {reminder.channel === "email" ? "Email" : "In-App Notification"}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeReminder(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddReminderDialogOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Reminder
            </Button>
            <Button onClick={saveReminders} disabled={savingReminders}>
              {savingReminders ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : savedReminders ? (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {savedReminders ? "Saved" : "Save Reminders"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Reminder Dialog */}
      <Dialog open={addReminderDialogOpen} onOpenChange={setAddReminderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Reminder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>When</Label>
              <Select value={newReminderMinutes} onValueChange={setNewReminderMinutes}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_TIME_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={String(preset.value)}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Channel</Label>
              <Select value={newReminderChannel} onValueChange={(v) => setNewReminderChannel(v as "email" | "in_app")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="in_app">In-App Notification</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={addReminder}>
              <Plus className="mr-2 h-4 w-4" />
              Add Reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {passwordError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {passwordError}
            </div>
          )}
          <div className="max-w-md space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={changePassword}
              disabled={savingPassword || !newPassword || !confirmPassword}
            >
              {savingPassword ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : savedPassword ? (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              ) : (
                <Lock className="mr-2 h-4 w-4" />
              )}
              {savedPassword ? "Password Updated" : "Update Password"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <TwoFactorSection showRecommendation />

      {/* Calendar Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendar Integration
          </CardTitle>
          <CardDescription>
            Connect your Google Calendar to automatically sync your availability.
            External calendar events will block platform time slots.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {calendarConnected ? (
            <>
              {/* Connected state */}
              <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium text-green-800 dark:text-green-200">
                    Google Calendar Connected
                  </p>
                  {calendarLastSynced && (
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Last synced: {new Date(calendarLastSynced).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              {/* Sync toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-sync</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically import calendar events as blocked times
                  </p>
                </div>
                <Switch
                  checked={calendarSyncEnabled}
                  onCheckedChange={async (checked) => {
                    setCalendarSyncEnabled(checked);
                    await toggleCalendarSync(checked);
                  }}
                />
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={syncingCalendar}
                  onClick={async () => {
                    setSyncingCalendar(true);
                    const result = await triggerCalendarSync();
                    if (result.success) {
                      setCalendarLastSynced(new Date().toISOString());
                    } else {
                      alert(result.error || "Sync failed");
                    }
                    setSyncingCalendar(false);
                  }}
                >
                  {syncingCalendar ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Sync Now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={disconnectingCalendar}
                  onClick={async () => {
                    if (!confirm("Disconnect Google Calendar? Synced blocked times will be removed.")) return;
                    setDisconnectingCalendar(true);
                    const result = await disconnectCalendar();
                    if (result.success) {
                      setCalendarConnected(false);
                      setCalendarLastSynced(null);
                    } else {
                      alert(result.error || "Failed to disconnect");
                    }
                    setDisconnectingCalendar(false);
                  }}
                >
                  {disconnectingCalendar ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Unlink className="mr-2 h-4 w-4" />
                  )}
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Disconnected state */}
              <div className="rounded-lg border border-dashed p-6 text-center">
                <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
                <h3 className="mt-3 font-medium">
                  Connect Google Calendar
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Import your Google Calendar events to automatically block
                  unavailable times. Confirmed bookings will also appear in your
                  Google Calendar.
                </p>
                <Button className="mt-4" asChild>
                  <a href="/api/calendar/google/connect">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Connect Google Calendar
                  </a>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Microsoft Calendar Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Microsoft Outlook / 365 Calendar
          </CardTitle>
          <CardDescription>
            Connect your Microsoft Outlook or Office 365 calendar for bidirectional sync.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {msCalendarConnected ? (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium text-green-800 dark:text-green-200">
                    Microsoft Calendar Connected
                  </p>
                  {msCalendarLastSynced && (
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Last synced: {new Date(msCalendarLastSynced).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-sync</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically import calendar events as blocked times
                  </p>
                </div>
                <Switch
                  checked={msCalendarSyncEnabled}
                  onCheckedChange={async (checked) => {
                    setMsCalendarSyncEnabled(checked);
                    await toggleMicrosoftCalendarSync(checked);
                  }}
                />
              </div>

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={syncingMsCalendar}
                  onClick={async () => {
                    setSyncingMsCalendar(true);
                    const result = await triggerMicrosoftCalendarSync();
                    if (result.success) {
                      setMsCalendarLastSynced(new Date().toISOString());
                    } else {
                      alert(result.error || "Sync failed");
                    }
                    setSyncingMsCalendar(false);
                  }}
                >
                  {syncingMsCalendar ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Sync Now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={disconnectingMsCalendar}
                  onClick={async () => {
                    if (!confirm("Disconnect Microsoft Calendar? Synced blocked times will be removed.")) return;
                    setDisconnectingMsCalendar(true);
                    const result = await disconnectMicrosoftCalendar();
                    if (result.success) {
                      setMsCalendarConnected(false);
                      setMsCalendarLastSynced(null);
                    } else {
                      alert(result.error || "Failed to disconnect");
                    }
                    setDisconnectingMsCalendar(false);
                  }}
                >
                  {disconnectingMsCalendar ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Unlink className="mr-2 h-4 w-4" />
                  )}
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-3 font-medium">
                Connect Microsoft Calendar
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Import Outlook/Office 365 events to block unavailable times.
                Bookings will also sync to your Microsoft Calendar.
              </p>
              <Button className="mt-4" asChild>
                <a href="/api/calendar/microsoft/connect">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Connect Microsoft Calendar
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ICS Calendar Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Calendar Subscription (ICS Feed)
          </CardTitle>
          <CardDescription>
            Subscribe to your bookings from any calendar app — Apple Calendar, Outlook, Google Calendar, Thunderbird, and more.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {icsFeedUrl ? (
            <>
              <div className="space-y-2">
                <Label>Feed URL</Label>
                <div className="flex gap-2">
                  <Input value={icsFeedUrl} readOnly className="font-mono text-xs" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(icsFeedUrl);
                      setCopiedFeed(true);
                      setTimeout(() => setCopiedFeed(false), 2000);
                    }}
                  >
                    {copiedFeed ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      "Copy"
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Paste this URL into your calendar app&apos;s &quot;Subscribe to Calendar&quot; or &quot;Add by URL&quot; feature. Your bookings will refresh automatically.
                </p>
              </div>

              <Separator />

              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={async () => {
                  if (!confirm("Revoke this feed URL? Any calendar apps using it will stop updating.")) return;
                  const result = await revokeIcsFeedToken();
                  if (result.success) setIcsFeedUrl(null);
                }}
              >
                <Unlink className="mr-2 h-4 w-4" />
                Revoke Feed URL
              </Button>
            </>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-3 font-medium">
                Generate Calendar Feed
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a private URL that any calendar app can subscribe to.
                Your upcoming bookings will appear automatically.
              </p>
              <Button
                className="mt-4"
                disabled={generatingFeed}
                onClick={async () => {
                  setGeneratingFeed(true);
                  const result = await generateIcsFeedToken();
                  if (result.url) setIcsFeedUrl(result.url);
                  setGeneratingFeed(false);
                }}
              >
                {generatingFeed ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Generate Feed URL
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CalDAV Calendar (Apple, Fastmail, Nextcloud, etc.) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Apple / CalDAV Calendar
          </CardTitle>
          <CardDescription>
            Connect Apple iCloud Calendar, Fastmail, Nextcloud, or any CalDAV-compatible calendar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {caldavConnected ? (
            <>
              <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium text-green-800 dark:text-green-200">
                    {caldavProviderName === "apple" ? "Apple iCloud" : caldavProviderName === "fastmail" ? "Fastmail" : caldavProviderName === "nextcloud" ? "Nextcloud" : "CalDAV"} Calendar Connected
                  </p>
                  {caldavLastSynced && (
                    <p className="text-sm text-green-600 dark:text-green-400">
                      Last synced: {new Date(caldavLastSynced).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-sync</p>
                  <p className="text-sm text-muted-foreground">
                    Automatically import calendar events as blocked times
                  </p>
                </div>
                <Switch
                  checked={caldavSyncEnabled}
                  onCheckedChange={async (checked) => {
                    setCaldavSyncEnabled(checked);
                    await toggleCalDAVSync(checked);
                  }}
                />
              </div>

              <Separator />

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={syncingCaldav}
                  onClick={async () => {
                    setSyncingCaldav(true);
                    const result = await triggerCalDAVSync();
                    if (result.success) {
                      setCaldavLastSynced(new Date().toISOString());
                    } else {
                      alert(result.error || "Sync failed");
                    }
                    setSyncingCaldav(false);
                  }}
                >
                  {syncingCaldav ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Sync Now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={disconnectingCaldav}
                  onClick={async () => {
                    if (!confirm("Disconnect CalDAV Calendar? Synced blocked times will be removed.")) return;
                    setDisconnectingCaldav(true);
                    const result = await disconnectCalDAV();
                    if (result.success) {
                      setCaldavConnected(false);
                      setCaldavLastSynced(null);
                    } else {
                      alert(result.error || "Failed to disconnect");
                    }
                    setDisconnectingCaldav(false);
                  }}
                >
                  {disconnectingCaldav ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Unlink className="mr-2 h-4 w-4" />
                  )}
                  Disconnect
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-dashed p-6 text-center">
                <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
                <h3 className="mt-3 font-medium">
                  Connect CalDAV Calendar
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Connect your Apple iCloud, Fastmail, Nextcloud, or other CalDAV calendar to sync availability.
                </p>
                <Dialog open={caldavDialogOpen} onOpenChange={setCaldavDialogOpen}>
                  <Button className="mt-4" onClick={() => setCaldavDialogOpen(true)}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Connect CalDAV Calendar
                  </Button>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Connect CalDAV Calendar</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                      <div className="space-y-2">
                        <Label>Provider</Label>
                        <Select
                          value={caldavProvider}
                          onValueChange={(val) => {
                            setCaldavProvider(val);
                            const providers: Record<string, string> = {
                              apple: "https://caldav.icloud.com",
                              fastmail: "https://caldav.fastmail.com/dav/calendars",
                              nextcloud: "",
                              other: "",
                            };
                            setCaldavServerUrl(providers[val] || "");
                            setCaldavError("");
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="apple">Apple iCloud</SelectItem>
                            <SelectItem value="fastmail">Fastmail</SelectItem>
                            <SelectItem value="nextcloud">Nextcloud</SelectItem>
                            <SelectItem value="other">Other CalDAV</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(caldavProvider === "nextcloud" || caldavProvider === "other") && (
                        <div className="space-y-2">
                          <Label>Server URL</Label>
                          <Input
                            placeholder="https://cloud.example.com/remote.php/dav"
                            value={caldavServerUrl}
                            onChange={(e) => setCaldavServerUrl(e.target.value)}
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label>{caldavProvider === "apple" ? "Apple ID Email" : "Username / Email"}</Label>
                        <Input
                          placeholder={caldavProvider === "apple" ? "your@icloud.com" : "username"}
                          value={caldavUsername}
                          onChange={(e) => setCaldavUsername(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>{caldavProvider === "apple" ? "App-Specific Password" : "Password / App Password"}</Label>
                        <Input
                          type="password"
                          placeholder="xxxx-xxxx-xxxx-xxxx"
                          value={caldavPassword}
                          onChange={(e) => setCaldavPassword(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          {caldavProvider === "apple"
                            ? "Generate an app-specific password at appleid.apple.com > Sign-In and Security > App-Specific Passwords."
                            : caldavProvider === "fastmail"
                              ? "Generate an app password from Fastmail Settings > Privacy & Security > Integrations."
                              : "Use your account password or generate an app-specific password from your provider."}
                        </p>
                      </div>

                      {caldavError && (
                        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          {caldavError}
                        </div>
                      )}
                    </div>

                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="outline">Cancel</Button>
                      </DialogClose>
                      <Button
                        disabled={caldavConnecting || !caldavUsername || !caldavPassword || !caldavServerUrl}
                        onClick={async () => {
                          setCaldavConnecting(true);
                          setCaldavError("");
                          const result = await connectCalDAV(
                            caldavProvider,
                            caldavServerUrl,
                            caldavUsername,
                            caldavPassword
                          );
                          if (result.success) {
                            setCaldavConnected(true);
                            setCaldavSyncEnabled(true);
                            setCaldavProviderName(caldavProvider);
                            setCaldavDialogOpen(false);
                            setCaldavUsername("");
                            setCaldavPassword("");
                          } else {
                            setCaldavError(result.error || "Connection failed");
                          }
                          setCaldavConnecting(false);
                        }}
                      >
                        {caldavConnecting ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ExternalLink className="mr-2 h-4 w-4" />
                        )}
                        Connect
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Account
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Profile Status</p>
              <p className="text-sm text-muted-foreground">
                {isActive
                  ? "Your profile is active and visible to patients."
                  : "Your profile is deactivated. Patients cannot find or book you."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-sm font-medium ${isActive ? "text-green-600" : "text-red-600"}`}
              >
                {isActive ? "Active" : "Deactivated"}
              </span>
              <Switch
                checked={isActive}
                onCheckedChange={(checked) => {
                  if (!checked) {
                    setDeactivateDialogOpen(true);
                  } else {
                    toggleActiveStatus();
                  }
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deactivate Confirmation Dialog */}
      <Dialog open={deactivateDialogOpen} onOpenChange={setDeactivateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">
                  Are you sure you want to deactivate your profile?
                </p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-yellow-700">
                  <li>Your profile will be hidden from search results</li>
                  <li>Patients will not be able to book new appointments</li>
                  <li>Existing appointments will not be affected</li>
                  <li>You can reactivate at any time</li>
                </ul>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Keep Active</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={toggleActiveStatus}
              disabled={savingAccount}
            >
              {savingAccount && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Deactivate Profile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
