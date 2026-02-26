"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  UserCircle,
  Globe,
  Lock,
  Bell,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  updatePersonalInfo,
  updatePreferences,
  changePassword,
  updateNotifications,
} from "./actions";
import { AvatarUpload } from "./avatar-upload";
import { AddressAutocomplete } from "./address-autocomplete";

interface ProfileData {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  avatar_url: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  preferred_locale: string | null;
  preferred_currency: string | null;
  notification_email: boolean | null;
  notification_sms: boolean | null;
  notification_whatsapp: boolean | null;
}

interface SettingsFormProps {
  profile: ProfileData;
  userEmail: string;
}

export function SettingsForm({ profile, userEmail }: SettingsFormProps) {
  return (
    <div className="space-y-6">
      <AvatarUpload
        avatarUrl={profile.avatar_url}
        firstName={profile.first_name}
        lastName={profile.last_name}
      />
      <PersonalInfoSection profile={profile} userEmail={userEmail} />
      <PreferencesSection profile={profile} />
      <ChangePasswordSection />
      <NotificationsSection profile={profile} />
    </div>
  );
}

// --- Personal Info ---
function PersonalInfoSection({
  profile,
  userEmail,
}: {
  profile: ProfileData;
  userEmail: string;
}) {
  const [phone, setPhone] = useState(profile.phone || "");
  const [addressLine1, setAddressLine1] = useState(profile.address_line1 || "");
  const [addressLine2, setAddressLine2] = useState(profile.address_line2 || "");
  const [city, setCity] = useState(profile.city || "");
  const [state, setState] = useState(profile.state || "");
  const [postalCode, setPostalCode] = useState(profile.postal_code || "");
  const [country, setCountry] = useState(profile.country || "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSave() {
    startTransition(async () => {
      const result = await updatePersonalInfo({
        phone: phone.trim() || null,
        address_line1: addressLine1.trim() || null,
        address_line2: addressLine2.trim() || null,
        city: city.trim() || null,
        state: state.trim() || null,
        postal_code: postalCode.trim() || null,
        country: country.trim() || null,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Personal information updated.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCircle className="h-4 w-4" />
          Personal Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={userEmail}
            disabled
            className="mt-1.5 bg-muted"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Email cannot be changed here.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="first-name">First Name</Label>
            <Input
              id="first-name"
              value={profile.first_name || ""}
              disabled
              className="mt-1.5 bg-muted"
            />
          </div>
          <div>
            <Label htmlFor="last-name">Last Name</Label>
            <Input
              id="last-name"
              value={profile.last_name || ""}
              disabled
              className="mt-1.5 bg-muted"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Name is set during registration and cannot be changed.
        </p>

        <div>
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 234 567 8900"
            className="mt-1.5"
          />
        </div>

        <Separator />

        <div>
          <Label htmlFor="address-line1">Address Line 1</Label>
          <AddressAutocomplete
            value={addressLine1}
            onChange={setAddressLine1}
            placeholder="Start typing your address..."
            onPlaceSelect={(addr) => {
              setAddressLine1(addr.addressLine1);
              if (addr.city) setCity(addr.city);
              if (addr.state) setState(addr.state);
              if (addr.postalCode) setPostalCode(addr.postalCode);
              if (addr.country) setCountry(addr.country);
            }}
          />
        </div>

        <div>
          <Label htmlFor="address-line2">Address Line 2</Label>
          <Input
            id="address-line2"
            value={addressLine2}
            onChange={(e) => setAddressLine2(e.target.value)}
            placeholder="Apartment, suite, etc. (optional)"
            className="mt-1.5"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="state">State / Province</Label>
            <Input
              id="state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="State or province"
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="postal-code">Postal Code</Label>
            <Input
              id="postal-code"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="Postal code"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Country"
              className="mt-1.5"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Preferences ---
function PreferencesSection({ profile }: { profile: ProfileData }) {
  const [locale, setLocale] = useState(profile.preferred_locale || "en");
  const [currency, setCurrency] = useState(
    profile.preferred_currency || "EUR"
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSave() {
    startTransition(async () => {
      const result = await updatePreferences({
        preferredLocale: locale,
        preferredCurrency: currency,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Preferences updated.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4" />
          Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Preferred Language</Label>
            <Select value={locale} onValueChange={setLocale}>
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="tr">Turkce</SelectItem>
                <SelectItem value="fr">Francais</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Preferred Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="mt-1.5 w-full">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EUR">EUR - Euro</SelectItem>
                <SelectItem value="GBP">GBP - British Pound</SelectItem>
                <SelectItem value="USD">USD - US Dollar</SelectItem>
                <SelectItem value="TRY">TRY - Turkish Lira</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Preferences"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Change Password ---
function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("All password fields are required.");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    startTransition(async () => {
      const result = await changePassword({
        currentPassword,
        newPassword,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4" />
          Change Password
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="current-password">Current Password</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            className="mt-1.5"
          />
        </div>

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="mt-1.5"
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Password must be at least 8 characters long.
        </p>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Password"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Notification Preferences ---
function NotificationsSection({ profile }: { profile: ProfileData }) {
  const [email, setEmail] = useState(profile.notification_email ?? true);
  const [sms, setSms] = useState(profile.notification_sms ?? false);
  const [whatsapp, setWhatsapp] = useState(
    profile.notification_whatsapp ?? false
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Validate phone has country code for WhatsApp
  const hasValidPhone = profile.phone?.startsWith("+") && (profile.phone?.length ?? 0) >= 8;
  const showWhatsAppWarning = whatsapp && !hasValidPhone;

  function handleSave() {
    if (whatsapp && !hasValidPhone) {
      toast.error(
        "Please add your phone number with country code (e.g., +49 123 456 7890) in Personal Information to enable WhatsApp notifications."
      );
      return;
    }

    startTransition(async () => {
      const result = await updateNotifications({
        notificationEmail: email,
        notificationSms: sms,
        notificationWhatsapp: whatsapp,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Notification preferences updated.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Choose how you want to receive notifications about your bookings and
          updates.
        </p>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Checkbox
              id="notif-email"
              checked={email}
              onCheckedChange={(checked) => setEmail(checked === true)}
            />
            <div>
              <Label htmlFor="notif-email" className="cursor-pointer">
                Email Notifications
              </Label>
              <p className="text-xs text-muted-foreground">
                Receive booking confirmations and reminders via email
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="notif-sms"
              checked={sms}
              onCheckedChange={(checked) => setSms(checked === true)}
            />
            <div>
              <Label htmlFor="notif-sms" className="cursor-pointer">
                SMS Notifications
              </Label>
              <p className="text-xs text-muted-foreground">
                Get text message reminders before your appointments
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="notif-whatsapp"
              checked={whatsapp}
              onCheckedChange={(checked) => setWhatsapp(checked === true)}
            />
            <div>
              <Label htmlFor="notif-whatsapp" className="cursor-pointer">
                WhatsApp Notifications
              </Label>
              <p className="text-xs text-muted-foreground">
                Receive updates and reminders via WhatsApp
              </p>
              {showWhatsAppWarning && (
                <p className="mt-1 text-xs text-amber-600">
                  Please add your phone number with country code (e.g., +49 123 456 7890) in Personal Information above to enable WhatsApp.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Notifications"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
