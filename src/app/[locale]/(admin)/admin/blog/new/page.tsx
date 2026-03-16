import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BlogEditor } from "../blog-editor";

export default async function NewBlogPostPage() {
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

  return <BlogEditor />;
}
