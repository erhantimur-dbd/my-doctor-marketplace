import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { BlogEditor } from "../blog-editor";

export default async function NewBlogPostPage() {
  await requireAdminPage();

  return <BlogEditor />;
}
