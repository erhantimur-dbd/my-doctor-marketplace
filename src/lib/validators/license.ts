import { z } from "zod/v4";

export const createLicenseCheckoutSchema = z.object({
  tier: z.enum(["starter", "professional", "clinic", "enterprise"]),
  billing_period: z.enum(["monthly", "annual"]).default("monthly"),
  coupon_code: z.string().max(50).optional(),
});

export const addExtraSeatsSchema = z.object({
  count: z.number().int().min(1).max(50),
});

export const removeExtraSeatsSchema = z.object({
  count: z.number().int().min(1).max(50),
});

export const toggleModuleSchema = z.object({
  module_key: z.string().min(1).max(50),
  enabled: z.boolean(),
});

export const upgradeTierSchema = z.object({
  new_tier: z.enum(["starter", "professional", "clinic", "enterprise"]),
});

// ─── Admin Schemas ──────────────────────────────────────────

export const adminOverrideLicenseStatusSchema = z.object({
  license_id: z.string().uuid(),
  new_status: z.enum(["active", "trialing", "past_due", "grace_period", "suspended", "cancelled"]),
  reason: z.string().min(1).max(500),
});

export const adminChangeLicenseTierSchema = z.object({
  license_id: z.string().uuid(),
  new_tier: z.enum(["starter", "professional", "clinic", "enterprise"]),
});

export const adminAdjustSeatsSchema = z.object({
  license_id: z.string().uuid(),
  max_seats: z.number().int().min(1).max(999),
  extra_seat_count: z.number().int().min(0).max(100),
});

export const adminExtendPeriodSchema = z.object({
  license_id: z.string().uuid(),
  new_period_end: z.string().min(1),
});

export const adminCreateLicenseSchema = z.object({
  organization_id: z.string().uuid(),
  tier: z.enum(["starter", "professional", "clinic", "enterprise"]),
  status: z.enum(["active", "trialing"]),
  max_seats: z.number().int().min(1).max(999),
  trial_days: z.number().int().min(1).max(365).optional(),
  is_promotional: z.boolean().optional(),
  promo_note: z.string().max(500).optional(),
});
