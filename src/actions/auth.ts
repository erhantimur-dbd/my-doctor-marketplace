"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/client";
import { welcomeEmail } from "@/lib/email/templates";
import { passwordSchema } from "@/lib/validators/password";
import { safeError } from "@/lib/utils/safe-error";

/** Derive the app origin from incoming request headers (works on localhost,
 *  Vercel preview deploys, and production). Falls back to env var. */
async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

/** Get client IP for rate limiting */
async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

export async function login(formData: FormData) {
  // Rate limit: 5 login attempts per 15 minutes per IP
  const ip = await getClientIp();
  const { limited } = rateLimit(`login:${ip}`, 5, 15 * 60 * 1000);
  if (limited) {
    return { error: "Too many login attempts. Please try again in a few minutes." };
  }

  const supabase = await createClient();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const redirectTo = formData.get("redirect") as string;
  const locale = (formData.get("locale") as string) || "en";

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: safeError(error) };
  }

  // Block unverified users — sign them out and prompt to verify
  if (data.user && !data.user.email_confirmed_at) {
    await supabase.auth.signOut();
    return {
      error:
        "Please verify your email address before signing in. Check your inbox for the verification link.",
    };
  }

  // Check if user has MFA enrolled — if so, redirect to verify-mfa
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal2" && aal?.currentLevel === "aal1") {
    return { mfaRequired: true, locale };
  }

  revalidatePath("/", "layout");

  // If there's an explicit redirect (e.g. from middleware), honour it
  // Only allow relative paths to prevent open redirect attacks
  if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
    redirect(redirectTo);
  }

  // Otherwise send the user to their role-specific dashboard
  const role = data.user?.user_metadata?.role as string | undefined;
  if (role === "doctor") {
    redirect(`/${locale}/doctor-dashboard`);
  } else if (role === "admin") {
    redirect(`/${locale}/admin`);
  } else {
    redirect(`/${locale}/dashboard`);
  }
}

export async function register(formData: FormData) {
  // Rate limit: 3 registrations per 30 minutes per IP
  const ip = await getClientIp();
  const { limited } = rateLimit(`register:${ip}`, 3, 30 * 60 * 1000);
  if (limited) {
    return { error: "Too many registration attempts. Please try again later." };
  }

  const supabase = await createClient();
  const origin = await getOrigin();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const firstName = formData.get("first_name") as string;
  const lastName = formData.get("last_name") as string;
  const locale = (formData.get("locale") as string) || "en";

  // Server-side password strength validation
  const pwResult = passwordSchema.safeParse(password);
  if (!pwResult.success) {
    return { error: pwResult.error.issues[0]?.message || "Password too weak." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        role: "patient",
      },
      emailRedirectTo: `${origin}/${locale}/callback`,
    },
  });

  if (error) {
    return { error: safeError(error) };
  }

  // Supabase returns a fake user with empty identities for duplicate emails
  // (to prevent email enumeration). Detect this and return a clear error.
  if (data.user?.identities?.length === 0) {
    return {
      error:
        "An account with this email already exists. Please sign in instead.",
    };
  }

  // Record terms/privacy acceptance (non-blocking)
  if (data.user) {
    const adminSupabase = createAdminClient();
    Promise.resolve(
      adminSupabase
        .from("profiles")
        .update({
          terms_accepted_at: new Date().toISOString(),
          privacy_accepted_at: new Date().toISOString(),
          terms_version: "2026-03-17",
        })
        .eq("id", data.user.id)
    ).catch((err) => console.error("[Auth] Terms acceptance recording error:", err));
  }

  // Send welcome email (non-blocking)
  const { subject, html } = welcomeEmail({ name: firstName || "there" });
  sendEmail({ to: email, subject, html }).catch((err) =>
    console.error("[Auth] Welcome email error:", err)
  );

  revalidatePath("/", "layout");
  redirect(`/${locale}/verify-email?email=${encodeURIComponent(email)}`);
}

// ─── Internal helper: shared doctor account creation ────────────────

async function createDoctorAccount(formData: FormData): Promise<
  | { error: string }
  | {
      userId: string;
      doctorId: string;
      orgId: string | null;
      email: string;
      locale: string;
    }
> {
  const ip = await getClientIp();
  const { limited } = rateLimit(`register:${ip}`, 3, 30 * 60 * 1000);
  if (limited) {
    return { error: "Too many registration attempts. Please try again later." };
  }

  const supabase = await createClient();
  const origin = await getOrigin();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const firstName = formData.get("first_name") as string;
  const lastName = formData.get("last_name") as string;
  const gmcNumber = (formData.get("gmc_number") as string)?.trim() || "";
  const referralCode = (formData.get("referral_code") as string)?.trim().toUpperCase() || "";
  const locale = (formData.get("locale") as string) || "en";
  const colleagueName = (formData.get("colleague_name") as string)?.trim() || "";
  const colleagueEmail = (formData.get("colleague_email") as string)?.trim().toLowerCase() || "";
  const hasTestingAddon = formData.get("has_testing_addon") === "true";

  // Server-side password strength validation
  const pwResult = passwordSchema.safeParse(password);
  if (!pwResult.success) {
    return { error: pwResult.error.issues[0]?.message || "Password too weak." };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        role: "doctor",
      },
      emailRedirectTo: `${origin}/${locale}/callback`,
    },
  });

  if (error) {
    return { error: safeError(error) };
  }

  if (!data.user) {
    return { error: "Account creation failed. Please try again." };
  }

  // Supabase returns a fake user with empty identities for duplicate emails
  // (to prevent email enumeration). Detect this and return a clear error.
  if (data.user.identities?.length === 0) {
    return {
      error:
        "An account with this email already exists. Please sign in instead.",
    };
  }

  // Use admin client because user has no active session yet
  // (email confirmation pending), so RLS policies would block.
  const adminSupabase = createAdminClient();

  // Wait for auth.users + profiles trigger to commit.
  let profileReady = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("id")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profile) {
      profileReady = true;
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // If trigger still hasn't fired after 5s, create profile manually.
  // Use upsert to handle the race condition where the trigger fires
  // between the last poll and this insert (avoids duplicate key error).
  if (!profileReady) {
    const { error: profileError } = await adminSupabase
      .from("profiles")
      .upsert(
        {
          id: data.user.id,
          role: "doctor",
          first_name: firstName,
          last_name: lastName,
          email,
        },
        { onConflict: "id" }
      );

    if (profileError) {
      console.error("Profile creation failed:", profileError);
      return {
        error:
          "Account created but profile setup is still processing. Please wait a moment and log in.",
      };
    }
  }

  const slug =
    `dr-${firstName}-${lastName}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    Math.random().toString(36).substring(2, 6);

  // Generate unique referral code for this new doctor
  const newReferralCode = (
    firstName.substring(0, 2) +
    lastName.substring(0, 2) +
    Math.random().toString(36).substring(2, 6)
  ).toUpperCase();

  // Address fields from registration form
  const clinicName = (formData.get("clinic_name") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim() || null;
  const postalCode = (formData.get("postal_code") as string)?.trim() || null;
  const countryCode = (formData.get("country") as string)?.trim() || null;

  // Resolve location_id from country code
  let locationId: string | null = null;
  if (countryCode) {
    const { data: location } = await adminSupabase
      .from("locations")
      .select("id")
      .eq("country_code", countryCode)
      .limit(1)
      .maybeSingle();
    if (location) locationId = location.id;
  }

  const { error: doctorError, data: newDoctor } = await adminSupabase
    .from("doctors")
    .insert({
      profile_id: data.user.id,
      slug,
      consultation_fee_cents: 0,
      referral_code: newReferralCode,
      has_testing_addon: hasTestingAddon,
      in_person_deposit_type: (() => {
        const dt = formData.get("in_person_deposit_type") as string;
        return ["none", "percentage", "flat"].includes(dt) ? dt : "none";
      })(),
      in_person_deposit_value: (() => {
        const dt = formData.get("in_person_deposit_type") as string;
        if (dt === "none" || !dt) return null;
        const dv = formData.get("in_person_deposit_value") as string;
        return dv ? parseInt(dv, 10) : null;
      })(),
      ...(gmcNumber && { gmc_number: gmcNumber }),
      ...(clinicName && { clinic_name: clinicName }),
      ...(address && { address }),
      ...(city && { city }),
      ...(postalCode && { postal_code: postalCode }),
      ...(locationId && { location_id: locationId }),
    })
    .select("id")
    .single();

  if (doctorError) {
    console.error("Doctor creation failed:", doctorError);
    return { error: safeError(doctorError) };
  }

  // Process referral code if provided (link this doctor as a referred signup)
  if (referralCode && newDoctor) {
    const { processReferralSignup } = await import("@/actions/referral");
    await processReferralSignup(newDoctor.id, email);
  }

  // Send colleague invitation if provided
  if (colleagueEmail && newDoctor) {
    const { sendReferralInvitationAtRegistration } = await import(
      "@/actions/referral"
    );
    const referrerName = `Dr. ${firstName} ${lastName}`;
    await sendReferralInvitationAtRegistration(
      newDoctor.id,
      newReferralCode,
      referrerName,
      colleagueName,
      colleagueEmail
    );
  }

  // Auto-create organization + owner membership for the new doctor
  let orgId: string | null = null;
  if (newDoctor) {
    try {
      const orgSlug =
        `dr-${firstName}-${lastName}-practice`
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") +
        "-" +
        Math.random().toString(36).substring(2, 6);

      const { data: newOrg } = await adminSupabase
        .from("organizations")
        .insert({
          name: `Dr. ${firstName} ${lastName}'s Practice`,
          slug: orgSlug,
          email,
        })
        .select("id")
        .single();

      if (newOrg) {
        orgId = newOrg.id;
        await adminSupabase.from("organization_members").insert({
          organization_id: newOrg.id,
          user_id: data.user.id,
          role: "owner",
          status: "active",
          accepted_at: new Date().toISOString(),
        });

        await adminSupabase
          .from("doctors")
          .update({ organization_id: newOrg.id })
          .eq("id", newDoctor.id);
      }
    } catch (orgErr) {
      // Non-blocking — doctor can still use the platform; org can be created later
      console.error("[Auth] Auto-org creation failed:", orgErr);
    }
  }

  return { userId: data.user.id, doctorId: newDoctor.id, orgId, email, locale };
}

// ─── Doctor Registration (Free Tier) ────────────────────────────────

export async function registerDoctor(formData: FormData) {
  const result = await createDoctorAccount(formData);
  if ("error" in result) return result;

  const tier = (formData.get("tier") as string) || "free";

  // Create free license for free tier
  if (tier === "free" && result.orgId) {
    const adminSupabase = createAdminClient();
    await adminSupabase.from("licenses").insert({
      organization_id: result.orgId,
      tier: "free",
      status: "active",
      max_seats: 1,
      used_seats: 1,
      current_period_start: new Date().toISOString(),
      current_period_end: "2099-12-31T23:59:59.000Z",
    });
  }

  revalidatePath("/", "layout");
  redirect(`/${result.locale}/verify-email?email=${encodeURIComponent(result.email)}`);
}

// ─── Doctor Registration (Paid Tier → Stripe Checkout) ──────────────

export async function registerDoctorWithCheckout(formData: FormData) {
  const result = await createDoctorAccount(formData);
  if ("error" in result) return result;

  const tier = (formData.get("tier") as string) || "starter";
  const seatCount = parseInt(formData.get("seat_count") as string) || 1;

  if (!result.orgId) {
    return { error: "Organization creation failed. Please try again." };
  }

  const { getLicenseTier } = await import("@/lib/constants/license-tiers");
  const tierConfig = getLicenseTier(tier);
  if (!tierConfig) return { error: "Invalid plan selected" };
  if (tierConfig.isFreeTier) return { error: "Free tier does not require checkout" };
  if (tierConfig.isCustomPricing) return { error: "Please contact us for Enterprise pricing" };

  const stripe = getStripe();
  const origin = await getOrigin();

  // Create Stripe customer for the org
  const customer = await stripe.customers.create({
    email: result.email,
    metadata: { organization_id: result.orgId },
  });

  // Store Stripe customer ID on org
  const adminSupabase = createAdminClient();
  await adminSupabase
    .from("organizations")
    .update({ stripe_customer_id: customer.id })
    .eq("id", result.orgId);

  // Create price on-the-fly in GBP
  const price = await stripe.prices.create({
    currency: "gbp",
    unit_amount: tierConfig.priceMonthlyPence,
    recurring: { interval: "month" },
    product_data: {
      name: `MyDoctors360 ${tierConfig.name} License`,
      metadata: { tier },
    },
  });

  const quantity = tierConfig.perUser ? Math.min(seatCount, tierConfig.maxSeats) : 1;

  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    mode: "subscription",
    line_items: [{ price: price.id, quantity }],
    subscription_data: {
      metadata: {
        organization_id: result.orgId,
        tier,
        type: "license",
      },
    },
    success_url: `${origin}/${result.locale}/verify-email?email=${encodeURIComponent(result.email)}&checkout=success`,
    cancel_url: `${origin}/${result.locale}/register-doctor?tier=${tier}&checkout=cancelled`,
  });

  return { checkoutUrl: session.url };
}

export async function registerTestingService(formData: FormData) {
  const ip = await getClientIp();
  const { limited } = rateLimit(`register:${ip}`, 3, 30 * 60 * 1000);
  if (limited) {
    return { error: "Too many registration attempts. Please try again later." };
  }

  const supabase = await createClient();
  const origin = await getOrigin();

  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const firstName = formData.get("first_name") as string;
  const lastName = formData.get("last_name") as string;
  const locale = (formData.get("locale") as string) || "en";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        role: "doctor",
      },
      emailRedirectTo: `${origin}/${locale}/callback`,
    },
  });

  if (error) {
    return { error: safeError(error) };
  }

  // Supabase returns a fake user with empty identities for duplicate emails
  // (to prevent email enumeration). Detect this and return a clear error.
  if (data.user?.identities?.length === 0) {
    return {
      error:
        "An account with this email already exists. Please sign in instead.",
    };
  }

  if (data.user) {
    const adminSupabase = createAdminClient();

    // Wait for auth trigger to create profile
    let profileReady = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      const { data: profile } = await adminSupabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profile) {
        profileReady = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (!profileReady) {
      const { error: profileError } = await adminSupabase
        .from("profiles")
        .insert({
          id: data.user.id,
          role: "doctor",
          first_name: firstName,
          last_name: lastName,
          email,
        });

      if (profileError) {
        console.error("Profile creation failed:", profileError);
        return {
          error:
            "Account created but profile setup is still processing. Please wait a moment and log in.",
        };
      }
    }

    const slug =
      `test-${firstName}-${lastName}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") +
      "-" +
      Math.random().toString(36).substring(2, 6);

    const newReferralCode = (
      firstName.substring(0, 2) +
      lastName.substring(0, 2) +
      Math.random().toString(36).substring(2, 6)
    ).toUpperCase();

    const { error: doctorError, data: newDoctor } = await adminSupabase
      .from("doctors")
      .insert({
        profile_id: data.user.id,
        slug,
        provider_type: "testing_service",
        consultation_fee_cents: 0,
        base_currency: "GBP",
        referral_code: newReferralCode,
      })
      .select("id")
      .single();

    if (doctorError) {
      console.error("Testing service creation failed:", doctorError);
      return { error: safeError(doctorError) };
    }

    // Auto-create organization + owner membership for testing service
    if (newDoctor) {
      try {
        const orgSlug =
          `${firstName}-${lastName}-testing`
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "") +
          "-" +
          Math.random().toString(36).substring(2, 6);

        const { data: newOrg } = await adminSupabase
          .from("organizations")
          .insert({
            name: `${firstName} ${lastName} Testing`,
            slug: orgSlug,
            email,
          })
          .select("id")
          .single();

        if (newOrg) {
          await adminSupabase.from("organization_members").insert({
            organization_id: newOrg.id,
            user_id: data.user.id,
            role: "owner",
            status: "active",
            accepted_at: new Date().toISOString(),
          });

          await adminSupabase
            .from("doctors")
            .update({ organization_id: newOrg.id })
            .eq("id", newDoctor.id);
        }
      } catch (orgErr) {
        console.error("[Auth] Auto-org creation for testing service failed:", orgErr);
      }
    }
  }

  revalidatePath("/", "layout");
  redirect(`/${locale}/verify-email?email=${encodeURIComponent(email)}`);
}

export async function resendVerificationEmail(email: string, locale: string = "en") {
  const ip = await getClientIp();
  const { limited } = rateLimit(`resend:${ip}`, 3, 15 * 60 * 1000);
  if (limited) {
    return { error: "Too many requests. Please try again later." };
  }

  const supabase = await createClient();
  const origin = await getOrigin();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      emailRedirectTo: `${origin}/${locale}/callback`,
    },
  });

  if (error) {
    return { error: safeError(error) };
  }

  return { success: true };
}

export async function forgotPassword(formData: FormData) {
  // Rate limit: 3 password reset requests per 15 minutes per IP
  const ip = await getClientIp();
  const { limited } = rateLimit(`forgot:${ip}`, 3, 15 * 60 * 1000);
  if (limited) {
    return { error: "Too many password reset requests. Please try again later." };
  }

  const supabase = await createClient();

  const email = formData.get("email") as string;

  const origin = await getOrigin();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/en/reset-password`,
  });

  if (error) {
    return { error: safeError(error) };
  }

  return { success: true };
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient();

  const password = formData.get("password") as string;

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    return { error: safeError(error) };
  }

  revalidatePath("/", "layout");
  redirect("/en/login");
}

export async function logout(locale: string = "en") {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(`/${locale}`);
}

export async function signInWithGoogle(locale: string = "en") {
  const supabase = await createClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/${locale}/callback`,
    },
  });

  if (error) {
    return { error: safeError(error) };
  }

  if (!data.url) {
    return { error: "Google sign-in is not configured. Please try another method." };
  }

  redirect(data.url);
}

export async function signInWithApple(locale: string = "en") {
  const supabase = await createClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: {
      redirectTo: `${origin}/${locale}/callback`,
    },
  });

  if (error) {
    return { error: safeError(error) };
  }

  if (!data.url) {
    return { error: "Apple sign-in is not configured. Please try another method." };
  }

  redirect(data.url);
}

export async function signInWithFacebook(locale: string = "en") {
  const supabase = await createClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "facebook",
    options: {
      redirectTo: `${origin}/${locale}/callback`,
    },
  });

  if (error) {
    return { error: safeError(error) };
  }

  if (!data.url) {
    return { error: "Facebook sign-in is not configured. Please try another method." };
  }

  redirect(data.url);
}

export async function signInWithAzure(locale: string = "en") {
  const supabase = await createClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "azure",
    options: {
      redirectTo: `${origin}/${locale}/callback`,
      scopes: "openid profile email",
    },
  });

  if (error) {
    return { error: safeError(error) };
  }

  if (!data.url) {
    return { error: "Microsoft sign-in is not configured. Please try another method." };
  }

  redirect(data.url);
}

export async function signInWithTwitter(locale: string = "en") {
  const supabase = await createClient();
  const origin = await getOrigin();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "twitter",
    options: {
      redirectTo: `${origin}/${locale}/callback`,
    },
  });

  if (error) {
    return { error: safeError(error) };
  }

  if (!data.url) {
    return { error: "X sign-in is not configured. Please try another method." };
  }

  redirect(data.url);
}
