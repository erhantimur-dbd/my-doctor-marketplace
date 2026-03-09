import { z } from "zod/v4";

export const createOrganizationSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters").max(100),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
    .optional(),
  email: z.email().optional(),
  phone: z.string().max(30).optional(),
  website: z.url().optional(),
  timezone: z.string().max(50).optional(),
  base_currency: z.enum(["EUR", "GBP", "TRY", "USD"]).optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.email().optional(),
  phone: z.string().max(30).optional(),
  website: z.url().optional(),
  address_line1: z.string().max(200).optional(),
  address_line2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  postal_code: z.string().max(20).optional(),
  country: z.string().max(2).optional(),
  timezone: z.string().max(50).optional(),
  base_currency: z.enum(["EUR", "GBP", "TRY", "USD"]).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.email("Please enter a valid email address"),
  role: z.enum(["admin", "doctor", "staff"]),
});

export const updateMemberRoleSchema = z.object({
  member_id: z.string().uuid(),
  role: z.enum(["admin", "doctor", "staff"]),
});

export const removeMemberSchema = z.object({
  member_id: z.string().uuid(),
});

export const transferOwnershipSchema = z.object({
  new_owner_id: z.string().uuid(),
});
