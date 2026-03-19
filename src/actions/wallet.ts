"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { creditWallet } from "@/lib/wallet";
import { sendEmail } from "@/lib/email/client";
import { giftCardEmail } from "@/lib/email/templates";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

async function getOriginAndLocale() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  const origin = host
    ? `${proto}://${host}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const referer = h.get("referer") || "";
  const localeMatch = referer.match(/\/(en|de|tr|fr)(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : "en";
  return { origin, locale };
}

// ---------------------------------------------------------------------------
// Wallet Top-Up
// ---------------------------------------------------------------------------

const TOP_UP_AMOUNTS: Record<string, number[]> = {
  GBP: [2500, 5000, 10000],    // £25, £50, £100
  EUR: [2500, 5000, 10000],    // €25, €50, €100
  USD: [2500, 5000, 10000],    // $25, $50, $100
  TRY: [50000, 100000, 250000], // ₺500, ₺1000, ₺2500
};

export async function getTopUpOptions(currency: string) {
  return TOP_UP_AMOUNTS[currency.toUpperCase()] || TOP_UP_AMOUNTS.GBP;
}

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

function generateGiftCardCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No ambiguous chars (0/O, 1/I)
  let code = "";
  const bytes = crypto.randomBytes(12);
  for (let i = 0; i < 12; i++) {
    code += chars[bytes[i] % chars.length];
  }
  // Format: XXXX-XXXX-XXXX
  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

export async function purchaseGiftCard(input: {
  amountCents: number;
  currency: string;
  recipientEmail: string;
  recipientName: string;
  message?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (input.amountCents < 1000) return { error: "Minimum gift card is £10" };
  if (input.amountCents > 50000) return { error: "Maximum gift card is £500" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user.id)
    .single();

  const cur = input.currency.toUpperCase();
  const code = generateGiftCardCode();
  const { origin, locale } = await getOriginAndLocale();

  // Create gift card record (pending payment)
  const adminClient = createAdminClient();
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year

  const { data: giftCard, error: insertError } = await adminClient
    .from("gift_cards")
    .insert({
      code,
      amount_cents: input.amountCents,
      currency: cur,
      purchased_by: user.id,
      purchased_email: profile?.email,
      recipient_email: input.recipientEmail,
      recipient_name: input.recipientName,
      message: input.message || null,
      status: "active",
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (insertError || !giftCard) {
    return { error: "Failed to create gift card" };
  }

  // Create Stripe checkout for purchase
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: cur.toLowerCase(),
          product_data: {
            name: `Gift Card for ${input.recipientName}`,
            description: `MyDoctors360 gift card — ${cur} ${(input.amountCents / 100).toFixed(2)}`,
          },
          unit_amount: input.amountCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      type: "gift_card_purchase",
      gift_card_id: giftCard.id,
      gift_card_code: code,
      recipient_email: input.recipientEmail,
      recipient_name: input.recipientName,
    },
    success_url: `${origin}/${locale}/dashboard/wallet?gift_sent=true`,
    cancel_url: `${origin}/${locale}/dashboard/wallet`,
  });

  return { url: session.url, giftCardId: giftCard.id };
}

export async function redeemGiftCard(code: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const adminClient = createAdminClient();

  // Find active gift card
  const { data: giftCard } = await adminClient
    .from("gift_cards")
    .select("*")
    .eq("code", code.toUpperCase().trim())
    .eq("status", "active")
    .maybeSingle();

  if (!giftCard) return { error: "Invalid or already redeemed gift card code." };

  // Check expiry
  if (giftCard.expires_at && new Date(giftCard.expires_at) < new Date()) {
    return { error: "This gift card has expired." };
  }

  // Credit wallet
  await creditWallet({
    patientId: user.id,
    currency: giftCard.currency,
    amountCents: giftCard.amount_cents,
    sourceType: "gift_card",
    description: `Gift card ${giftCard.code} redeemed`,
  });

  // Mark as redeemed
  await adminClient
    .from("gift_cards")
    .update({
      status: "redeemed",
      redeemed_by: user.id,
      redeemed_at: new Date().toISOString(),
    })
    .eq("id", giftCard.id);

  revalidatePath("/dashboard/wallet");
  return {
    success: true,
    amountCents: giftCard.amount_cents,
    currency: giftCard.currency,
  };
}
