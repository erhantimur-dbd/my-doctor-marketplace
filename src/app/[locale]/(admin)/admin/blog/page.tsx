import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, FileText, Eye, Pencil } from "lucide-react";

export default async function AdminBlogPage() {
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
  const { data: posts } = await adminDb
    .from("blog_posts")
    .select(
      "id, slug, title, status, locale, tags, view_count, published_at, created_at"
    )
    .order("created_at", { ascending: false });

  const publishedCount =
    posts?.filter((p: any) => p.status === "published").length || 0;
  const draftCount =
    posts?.filter((p: any) => p.status === "draft").length || 0;
  const totalViews =
    posts?.reduce((sum: number, p: any) => sum + (p.view_count || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Blog Management</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage blog articles for your platform
          </p>
        </div>
        <Link href="/admin/blog/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Article
          </Button>
        </Link>
      </div>

      <div className="flex gap-3">
        <Badge variant="secondary" className="px-3 py-1">
          {publishedCount} published
        </Badge>
        <Badge variant="outline" className="px-3 py-1">
          {draftCount} drafts
        </Badge>
        <Badge variant="outline" className="px-3 py-1">
          <Eye className="mr-1 h-3 w-3" />
          {totalViews.toLocaleString()} total views
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            All Articles
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!posts || posts.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <FileText className="mx-auto mb-3 h-10 w-10 opacity-40" />
              <p className="font-medium">No blog posts yet</p>
              <p className="text-sm">
                Create your first article to get started
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {posts.map((post: any) => (
                  <TableRow key={post.id}>
                    <TableCell className="max-w-[300px]">
                      <p className="truncate font-medium">{post.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        /{post.slug}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          post.status === "published"
                            ? "default"
                            : post.status === "draft"
                              ? "secondary"
                              : "outline"
                        }
                        className={
                          post.status === "published"
                            ? "bg-green-600 hover:bg-green-700"
                            : ""
                        }
                      >
                        {post.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(post.tags || []).slice(0, 3).map((tag: string) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="text-xs"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {(post.tags || []).length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{post.tags.length - 3}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {(post.view_count || 0).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {post.published_at
                        ? new Date(post.published_at).toLocaleDateString(
                            "en-GB",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/blog/${post.id}`}>
                          <Button variant="ghost" size="sm">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        {post.status === "published" && (
                          <Link href={`/blog/${post.slug}`}>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
