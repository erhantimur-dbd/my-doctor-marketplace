"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updatePersonalInfo(input: {
  firstName: string;
  lastName: string;
  phone: string | null;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  if (!input.firstName.trim() || !input.lastName.trim()) {
    return { error: "First name and last name are required." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      phone: input.phone?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: "Failed to update personal information." };
  }

  revalidatePath("/dashboard/settings");
  return {};
}

export async function updatePreferences(input: {
  preferredLocale: string;
  preferredCurrency: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  const validLocales = ["en", "de", "tr", "fr"];
  const validCurrencies = ["EUR", "GBP", "USD", "TRY"];

  if (!validLocales.includes(input.preferredLocale)) {
    return { error: "Invalid locale selected." };
  }

  if (!validCurrencies.includes(input.preferredCurrency)) {
    return { error: "Invalid currency selected." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      preferred_locale: input.preferredLocale,
      preferred_currency: input.preferredCurrency,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: "Failed to update preferences." };
  }

  revalidatePath("/dashboard/settings");
  return {};
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  if (input.newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  // Verify current password by attempting to sign in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: input.currentPassword,
  });

  if (signInError) {
    return { error: "Current password is incorrect." };
  }

  // Update password
  const { error: updateError } = await supabase.auth.updateUser({
    password: input.newPassword,
  });

  if (updateError) {
    return { error: "Failed to update password. Please try again." };
  }

  return {};
}

export async function updateNotifications(input: {
  notificationEmail: boolean;
  notificationSms: boolean;
  notificationWhatsapp: boolean;
}): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      notification_email: input.notificationEmail,
      notification_sms: input.notificationSms,
      notification_whatsapp: input.notificationWhatsapp,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    return { error: "Failed to update notification preferences." };
  }

  revalidatePath("/dashboard/settings");
  return {};
}
