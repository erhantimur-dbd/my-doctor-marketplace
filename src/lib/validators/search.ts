import { z } from "zod/v4";

export const searchSchema = z.object({
  specialty: z.string().optional(),
  location: z.string().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  language: z.string().optional(),
  consultationType: z.enum(["in_person", "video"]).optional(),
  query: z.string().optional(),
  sort: z
    .enum(["rating", "price_asc", "price_desc", "featured"])
    .optional()
    .default("featured"),
  page: z.coerce.number().min(1).optional().default(1),
});

export type SearchInput = z.infer<typeof searchSchema>;
