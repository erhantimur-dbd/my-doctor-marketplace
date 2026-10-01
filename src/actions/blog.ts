"use server";
import { safeError } from "@/lib/utils/safe-error";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminEmailGateError } from "@/lib/admin/admin-email-allowlist";
import { z } from "zod/v4";

const blogPostSchema = z.object({
  title: z.string().min(1).max(300),
  slug: z.string().min(1).max(200),
  excerpt: z.string().max(500).nullish(),
  body: z.string().min(1),
  locale: z.string().default("en"),
  cover_image_url: z.string().url().nullish(),
  tags: z.array(z.string()).default([]),
  meta_title: z.string().max(100).nullish(),
  meta_description: z.string().max(300).nullish(),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
});

export type BlogPostInput = z.infer<typeof blogPostSchema>;

async function requirePlatformAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const, user: null };
  if (adminEmailGateError(user.email)) {
    return { error: "Unauthorized" as const, user: null };
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return { error: "Unauthorized" as const, user: null };
  }
  return { error: null, user };
}

/**
 * Get published blog posts (public).
 */
export async function getPublishedPosts(
  locale = "en",
  page = 1,
  perPage = 12
) {
  const adminDb = createAdminClient();
  const from = (page - 1) * perPage;

  const { data: posts, count } = await adminDb
    .from("blog_posts")
    .select("id, slug, title, excerpt, cover_image_url, tags, published_at, view_count, author:profiles!blog_posts_author_id_fkey(first_name, last_name)", { count: "exact" })
    .eq("status", "published")
    .eq("locale", locale)
    .order("published_at", { ascending: false })
    .range(from, from + perPage - 1);

  return { posts: posts || [], total: count || 0, page, perPage };
}

/**
 * Get a single published post by slug (public).
 */
export async function getPostBySlug(slug: string) {
  const adminDb = createAdminClient();

  const { data: post } = await adminDb
    .from("blog_posts")
    .select("*, author:profiles!blog_posts_author_id_fkey(first_name, last_name, avatar_url)")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  // Increment view count
  if (post) {
    await adminDb
      .from("blog_posts")
      .update({ view_count: (post.view_count || 0) + 1 })
      .eq("id", post.id);
  }

  return post;
}

/**
 * Get all blog posts (admin).
 */
export async function getAdminPosts(page = 1, perPage = 20) {
  const auth = await requirePlatformAdmin();
  if (auth.error || !auth.user) return { posts: [], total: 0, page, perPage };

  const adminDb = createAdminClient();
  const from = (page - 1) * perPage;

  const { data: posts, count } = await adminDb
    .from("blog_posts")
    .select("id, slug, title, status, locale, published_at, view_count, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + perPage - 1);

  return { posts: posts || [], total: count || 0, page, perPage };
}

/**
 * Create a blog post (admin only).
 */
export async function createBlogPost(input: BlogPostInput) {
  const parsed = blogPostSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const auth = await requirePlatformAdmin();
  if (auth.error || !auth.user) return { error: auth.error || "Unauthorized" };
  const user = auth.user;

  const adminDb = createAdminClient();
  const { data, error } = await adminDb
    .from("blog_posts")
    .insert({
      ...parsed.data,
      author_id: user.id,
      published_at: parsed.data.status === "published" ? new Date().toISOString() : null,
    })
    .select("id, slug")
    .single();

  if (error) return { error: safeError(error) };
  return { post: data };
}

/**
 * Update a blog post (admin only).
 */
export async function updateBlogPost(postId: string, input: Partial<BlogPostInput>) {
  const parsed = blogPostSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const auth = await requirePlatformAdmin();
  if (auth.error || !auth.user) return { error: auth.error || "Unauthorized" };

  const adminDb = createAdminClient();

  // Schema parse drops keys that are not blog columns (author_id, view_count).
  const updateData: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.status === "published") {
    const { data: existing } = await adminDb
      .from("blog_posts")
      .select("published_at")
      .eq("id", postId)
      .single();
    if (!existing?.published_at) {
      updateData.published_at = new Date().toISOString();
    }
  }

  const { error } = await adminDb
    .from("blog_posts")
    .update(updateData)
    .eq("id", postId);

  if (error) return { error: safeError(error) };
  return { success: true };
}

/**
 * Delete a blog post (admin only).
 */
export async function deleteBlogPost(postId: string) {
  const auth = await requirePlatformAdmin();
  if (auth.error || !auth.user) return { error: auth.error || "Unauthorized" };

  const adminDb = createAdminClient();
  const { error } = await adminDb
    .from("blog_posts")
    .delete()
    .eq("id", postId);

  if (error) return { error: safeError(error) };
  return { success: true };
}
