"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { revalidatePath } from "next/cache";

async function getOriginAndLocale() {
  const { getRequestOriginAndLocale } = await import("@/lib/http/origin");
  return getRequestOriginAndLocale("en");
}

// ---------------------------------------------------------------------------
// Wallet Top-Up
// ---------------------------------------------------------------------------

export async function topUpWallet(amountCents: number, currency: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (amountCents < 500) return { error: "Minimum top-up is 500 cents" };
  if (amountCents > 50000000) return { error: "Amount too large" };

  const cur = currency.toUpperCase();
  const { origin, locale } = await getOriginAndLocale();

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: cur.toLowerCase(),
          product_data: {
            name: "Wallet Top-Up",
            description: `Add funds to your MyDoctors360 wallet`,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "wallet_top_up",
      patient_id: user.id,
      amount_cents: String(amountCents),
      currency: cur,
    },
    success_url: `${origin}/${locale}/dashboard/wallet?topped_up=true`,
    cancel_url: `${origin}/${locale}/dashboard/wallet`,
  });

  return { url: session.url };
}

// ---------------------------------------------------------------------------
// Gift Cards
// ---------------------------------------------------------------------------

export async function redeemGiftCard(code: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const adminClient = createAdminClient();

  // Atomic claim + wallet credit (prevents double-redeem races)
  const { data, error } = await adminClient.rpc("redeem_gift_card_atomic", {
    p_code: code,
    p_patient_id: user.id,
  });

  if (error) {
    const msg = error.message || "";
    if (msg.includes("GIFT_CARD_EXPIRED")) {
      return { error: "This gift card has expired." };
    }
    if (msg.includes("GIFT_CARD_INVALID")) {
      return { error: "Invalid or already redeemed gift card code." };
    }
    return { error: "Unable to redeem gift card. Please try again." };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { error: "Invalid or already redeemed gift card code." };
  }

  revalidatePath("/dashboard/wallet");
  return {
    success: true,
    amountCents: row.amount_cents as number,
    currency: row.currency as string,
  };
}
