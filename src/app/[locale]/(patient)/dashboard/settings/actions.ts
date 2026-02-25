"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updatePersonalInfo(input: {
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
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
      phone: input.phone?.trim() || null,
      address_line1: input.address_line1?.trim() || null,
      address_line2: input.address_line2?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      postal_code: input.postal_code?.trim() || null,
      country: input.country?.trim() || null,
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

export async function uploadAvatar(
  formData: FormData
): Promise<{ error?: string; avatarUrl?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in." };

  const file = formData.get("avatar") as File;
  if (!file || file.size === 0) return { error: "No file provided." };
  if (file.size > 5 * 1024 * 1024) return { error: "File too large (max 5MB)." };

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return { error: "Only JPEG, PNG, and WebP images are allowed." };
  }

  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const filePath = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(filePath, file, { upsert: true, contentType: file.type });

  if (uploadError) return { error: "Failed to upload image." };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(filePath);

  const avatarUrl = `${publicUrl}?t=${Date.now()}`;
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (updateError) return { error: "Failed to update profile." };

  revalidatePath("/dashboard/settings");
  return { avatarUrl };
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
