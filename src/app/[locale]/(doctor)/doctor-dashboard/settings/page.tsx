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
} from "lucide-react";
import {
  getCalendarConnection,
  disconnectCalendar,
  triggerCalendarSync,
  toggleCalendarSync,
} from "@/actions/calendar";

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
    if (!user) return;

    setUserId(user.id);
    setEmail(user.email || "");

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, last_name, phone")
      .eq("id", user.id)
      .single();

    if (profile) {
      setFirstName(profile.first_name || "");
      setLastName(profile.last_name || "");
      setPhone(profile.phone || "");
    }

    const { data: doctor } = await supabase
      .from("doctors")
      .select("id, is_active")
      .eq("profile_id", user.id)
      .single();

    if (doctor) {
      setDoctorId(doctor.id);
      setIsActive(doctor.is_active);
    }

    // Load calendar connection
    const calConn = await getCalendarConnection();
    if (calConn) {
      setCalendarConnected(true);
      setCalendarSyncEnabled(calConn.sync_enabled);
      setCalendarLastSynced(calConn.last_synced_at);
    }

    // Check URL params for calendar connection result
    const params = new URLSearchParams(window.location.search);
    if (params.get("calendar_connected") === "true") {
      setCalendarConnected(true);
      setCalendarSyncEnabled(true);
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }

    setLoading(false);
  }

  async function savePersonalInfo() {
    if (!userId) return;
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

  async function saveNotificationPrefs() {
    // In a real app, this would save to a notification_preferences table
    setSavingNotifications(true);
    setSavedNotifications(false);

    // Simulate save
    await new Promise((res) => setTimeout(res, 500));

    setSavingNotifications(false);
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
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
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
              />
            </div>
          </div>
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
                Receive notifications through WhatsApp
              </p>
            </div>
            <Switch
              checked={whatsappNotifications}
              onCheckedChange={setWhatsappNotifications}
            />
          </div>
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
