import { getPublishedPosts } from "@/actions/blog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import {
  Calendar,
  Eye,
  ArrowRight,
  BookOpen,
  Stethoscope,
  Heart,
  Brain,
  Activity,
  Flower,
  Baby,
  Ear,
  Smile,
  Apple,
  Droplets,
  Wind,
  Shield,
  Scan,
} from "lucide-react";
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
      {/* ── Hero gradient bar ── */}
      <div className="relative bg-gradient-to-br from-primary via-primary/90 to-teal-600 dark:from-primary/80 dark:via-primary/70 dark:to-teal-800">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_-20%,rgba(255,255,255,0.12),transparent_60%)]" />

        {/* Decorative specialty icons */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {/* Row 1 — top edge */}
          <Stethoscope className="absolute top-2 left-[3%] h-7 w-7 text-white/[0.07] rotate-12" />
          <Heart className="absolute top-3 left-[12%] h-5 w-5 text-white/[0.06] -rotate-6" />
          <Flower className="absolute top-1 left-[22%] h-5 w-5 text-white/[0.07] rotate-[18deg]" />
          <Activity className="absolute top-4 left-[31%] h-6 w-6 text-white/[0.05] -rotate-12" />
          <Brain className="absolute top-2 left-[41%] h-7 w-7 text-white/[0.06] rotate-6" />
          <Brain className="absolute top-3 left-[52%] h-5 w-5 text-white/[0.05] -rotate-[15deg]" />
          <Heart className="absolute top-1 left-[61%] h-4 w-4 text-white/[0.06] rotate-[22deg]" />
          <Eye className="absolute top-4 left-[71%] h-6 w-6 text-white/[0.07] -rotate-6" />
          <Ear className="absolute top-2 left-[80%] h-5 w-5 text-white/[0.06] rotate-[10deg]" />
          <Baby className="absolute top-3 left-[89%] h-6 w-6 text-white/[0.05] -rotate-12" />
          <Scan className="absolute top-1 left-[96%] h-5 w-5 text-white/[0.06] rotate-6" />

          {/* Row 2 — bottom edge */}
          <Activity className="absolute bottom-2 left-[1%] h-5 w-5 text-white/[0.06] -rotate-[20deg]" />
          <Apple className="absolute bottom-4 left-[10%] h-6 w-6 text-white/[0.05] rotate-12" />
          <Droplets className="absolute bottom-2 left-[19%] h-5 w-5 text-white/[0.07] -rotate-6" />
          <Wind className="absolute bottom-3 left-[28%] h-6 w-6 text-white/[0.06] rotate-[15deg]" />
          <Shield className="absolute bottom-1 left-[37%] h-5 w-5 text-white/[0.05] -rotate-12" />
          <Baby className="absolute bottom-4 left-[46%] h-5 w-5 text-white/[0.07] rotate-6" />
          <Smile className="absolute bottom-2 left-[55%] h-6 w-6 text-white/[0.06] -rotate-[8deg]" />
          <Flower className="absolute bottom-3 left-[64%] h-5 w-5 text-white/[0.05] rotate-[20deg]" />
          <Activity className="absolute bottom-1 left-[73%] h-6 w-6 text-white/[0.06] -rotate-12" />
          <Apple className="absolute bottom-4 left-[82%] h-5 w-5 text-white/[0.07] rotate-[10deg]" />
          <Flower className="absolute bottom-2 left-[88%] h-4 w-4 text-white/[0.06] -rotate-6" />
          <Activity className="absolute bottom-3 left-[93%] h-5 w-5 text-white/[0.05] rotate-[25deg]" />
          <Droplets className="absolute bottom-1 left-[98%] h-5 w-5 text-white/[0.06] -rotate-[15deg]" />
        </div>

        <div className="relative container mx-auto px-4 pb-5 pt-6 lg:pb-7 lg:pt-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
                Health Blog
              </h1>
              <p className="text-sm text-white/70">
                Expert health articles, tips, and medical insights from our doctors
              </p>
            </div>
          </div>
        </div>
      </div>

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
