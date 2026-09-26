import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import { BlogEditor } from "../blog-editor";

interface EditBlogPostPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBlogPostPage({
  params,
}: EditBlogPostPageProps) {
  const { id } = await params;

  await requireAdminPage();

  const adminDb = createAdminClient();
  const { data: post } = await adminDb
    .from("blog_posts")
    .select(
      "id, slug, title, excerpt, body, locale, cover_image_url, tags, meta_title, meta_description, status"
    )
    .eq("id", id)
    .single();

  if (!post) notFound();

  return <BlogEditor post={post as any} />;
}
