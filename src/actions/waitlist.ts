"use server";

import { z } from "zod/v4";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// ─── Public actions (no auth required) ────────────────────────────

const doctorWaitlistSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  specialty: z.string().min(1, "Specialty is required"),
  country: z.string().min(2, "Country is required"),
});

export async function joinDoctorWaitlist(formData: FormData) {
  const parsed = doctorWaitlistSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    specialty: formData.get("specialty"),
    country: formData.get("country"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("doctor_waitlist").upsert(
    {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      specialty: parsed.data.specialty,
      country: parsed.data.country,
    },
    { onConflict: "email" }
  );

  if (error) {
    console.error("Doctor waitlist error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  return { success: true };
}

const launchNotificationSchema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.string().email("Valid email is required"),
  region: z.string().min(2, "Region is required"),
});

export async function subscribeToLaunchNotification(formData: FormData) {
  const parsed = launchNotificationSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    region: formData.get("region"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("launch_notifications").upsert(
    {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      region: parsed.data.region,
    },
    { onConflict: "email,region" }
  );

  if (error) {
    console.error("Launch notification error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  return { success: true };
}

// ─── Admin actions ────────────────────────────────────────────────

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const };

  if (
    ADMIN_EMAILS.length > 0 &&
    !ADMIN_EMAILS.includes(user.email?.toLowerCase() || "")
  ) {
    return { error: "Not authorized" as const };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { error: "Not authorized" as const };

  return { error: null };
}

export async function getAdminWaitlistDoctors(filters?: {
  country?: string;
  specialty?: string;
  status?: string;
}) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error, data: [] };

  const admin = createAdminClient();
  let query = admin
    .from("doctor_waitlist")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.country) query = query.eq("country", filters.country);
  if (filters?.specialty) query = query.eq("specialty", filters.specialty);
  if (filters?.status) query = query.eq("status", filters.status);

  const { data, error } = await query;
  if (error) return { error: error.message, data: [] };
  return { error: null, data: data || [] };
}

export async function getAdminLaunchNotifications(filters?: {
  region?: string;
}) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error, data: [] };

  const admin = createAdminClient();
  let query = admin
    .from("launch_notifications")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.region) query = query.eq("region", filters.region);

  const { data, error } = await query;
  if (error) return { error: error.message, data: [] };
  return { error: null, data: data || [] };
}

export async function updateDoctorWaitlistStatus(
  id: string,
  status: "new" | "contacted" | "converted"
) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const admin = createAdminClient();
  const { error } = await admin
    .from("doctor_waitlist")
    .update({ status })
    .eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/waitlist");
  return { error: null };
}

export async function getWaitlistAnalytics() {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error, data: null };

  const admin = createAdminClient();

  // Fetch all data for analytics
  const [doctorsRes, patientsRes] = await Promise.all([
    admin.from("doctor_waitlist").select("country, specialty, status, created_at"),
    admin.from("launch_notifications").select("region, created_at"),
  ]);

  const doctors = doctorsRes.data || [];
  const patients = patientsRes.data || [];

  // Region breakdown (doctors + patients combined)
  const regionMap: Record<string, { doctors: number; patients: number }> = {};
  for (const d of doctors) {
    if (!regionMap[d.country]) regionMap[d.country] = { doctors: 0, patients: 0 };
    regionMap[d.country].doctors++;
  }
  for (const p of patients) {
    if (!regionMap[p.region]) regionMap[p.region] = { doctors: 0, patients: 0 };
    regionMap[p.region].patients++;
  }

  const byRegion = Object.entries(regionMap)
    .map(([region, counts]) => ({
      region,
      doctors: counts.doctors,
      patients: counts.patients,
      total: counts.doctors + counts.patients,
    }))
    .sort((a, b) => b.total - a.total);

  // Specialty breakdown (doctors only)
  const specialtyMap: Record<string, number> = {};
  for (const d of doctors) {
    specialtyMap[d.specialty] = (specialtyMap[d.specialty] || 0) + 1;
  }
  const bySpecialty = Object.entries(specialtyMap)
    .map(([specialty, count]) => ({ specialty, count }))
    .sort((a, b) => b.count - a.count);

  // Weekly sign-up trend (last 12 weeks)
  const now = new Date();
  const weeklyTrend: { week: string; doctors: number; patients: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekLabel = weekStart.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });

    const dCount = doctors.filter((d) => {
      const created = new Date(d.created_at);
      return created >= weekStart && created < weekEnd;
    }).length;

    const pCount = patients.filter((p) => {
      const created = new Date(p.created_at);
      return created >= weekStart && created < weekEnd;
    }).length;

    weeklyTrend.push({ week: weekLabel, doctors: dCount, patients: pCount });
  }

  return {
    error: null,
    data: {
      totalDoctors: doctors.length,
      totalPatients: patients.length,
      topRegion: byRegion[0]?.region || "N/A",
      topSpecialty: bySpecialty[0]?.specialty || "N/A",
      byRegion,
      bySpecialty,
      weeklyTrend,
      statusBreakdown: {
        new: doctors.filter((d) => d.status === "new").length,
        contacted: doctors.filter((d) => d.status === "contacted").length,
        converted: doctors.filter((d) => d.status === "converted").length,
      },
    },
  };
}
