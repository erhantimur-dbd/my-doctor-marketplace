import { createClient } from "@/lib/supabase/server";
import { isOfferAdminEmail, parseOfferAdminEmails } from "@/lib/offers/admin-auth";

const ADMIN_EMAILS = parseOfferAdminEmails(process.env.ADMIN_EMAILS);

/** Server-side founder gate. Not a server action, so it cannot be called from the client. */
export async function requireOfferAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authorized", user: null as null };

  const isProduction =
    process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
  if (isProduction && ADMIN_EMAILS.length === 0) {
    return { error: "Not authorized", user: null };
  }
  if (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(user.email?.toLowerCase() || "")) {
    return { error: "Not authorized", user: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { error: "Not authorized", user: null };

  const offerAdmins = parseOfferAdminEmails(process.env.OFFER_ADMIN_EMAILS);
  if (!isOfferAdminEmail(user.email, offerAdmins)) {
    return { error: "Not authorized", user: null };
  }
  return { error: null, user };
}
