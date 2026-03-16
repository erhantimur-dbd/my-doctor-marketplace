import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/en/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/en");

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
