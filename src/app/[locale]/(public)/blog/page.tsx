import { getPublishedPosts } from "@/actions/blog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { Calendar, Eye, ArrowRight } from "lucide-react";
import { HeroSpecialtyIcons } from "@/components/shared/hero-specialty-icons";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Health Blog",
  description: "Expert health articles, tips, and medical insights from our doctors.",
};

interface BlogPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}

export default async function BlogPage({ params, searchParams }: BlogPageProps) {
  const { locale } = await params;
  const sp = await searchParams;
  const page = sp.page ? Number(sp.page) : 1;

  const { posts, total, perPage } = await getPublishedPosts(locale, page);
  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-16 md:py-24">
        <HeroSpecialtyIcons />
        <div className="relative container mx-auto text-center">
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            Health Blog
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Expert health articles, tips, and medical insights from our doctors
          </p>
        </div>
      </section>

      {/* ── Content ── */}
      <div className="container mx-auto px-4 py-8">
        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <p className="text-lg font-medium text-muted-foreground">
              No articles published yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Check back soon for health insights from our doctors
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post: any) => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <Card className="h-full overflow-hidden transition-shadow hover:shadow-md">
                  {post.cover_image_url && (
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={post.cover_image_url}
                        alt={post.title}
                        className="h-full w-full object-cover transition-transform hover:scale-105"
                      />
                    </div>
                  )}
                  <CardContent className="p-5">
                    {post.tags?.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1">
                        {post.tags.slice(0, 3).map((tag: string) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <h2 className="mb-2 text-lg font-semibold line-clamp-2">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="mb-3 text-sm text-muted-foreground line-clamp-3">
                        {post.excerpt}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        {post.published_at && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(post.published_at).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        )}
                        {(post.view_count || 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {post.view_count}
                          </span>
                        )}
                      </div>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <a
                key={p}
                href={`?page=${p}`}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-sm ${
                  p === page
                    ? "bg-primary text-primary-foreground"
                    : "border hover:bg-accent"
                }`}
              >
                {p}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
