import { getPostBySlug } from "@/actions/blog";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Calendar, Eye, User } from "lucide-react";
import type { Metadata } from "next";

interface BlogPostPageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) return { title: "Article Not Found" };

  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.excerpt || undefined,
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post: any = await getPostBySlug(slug);

  if (!post) notFound();

  const author = post.author;

  return (
    <div className="container mx-auto px-4 py-8">
      <Button variant="ghost" size="sm" className="mb-6" asChild>
        <Link href="/blog">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to Blog
        </Link>
      </Button>

      <article className="mx-auto max-w-3xl">
        {/* Header */}
        {post.cover_image_url && (
          <div className="mb-6 overflow-hidden rounded-lg">
            <img
              src={post.cover_image_url}
              alt={post.title}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {post.tags.map((tag: string) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <h1 className="mb-4 text-3xl font-bold leading-tight lg:text-4xl">
          {post.title}
        </h1>

        {/* Meta */}
        <div className="mb-6 flex items-center gap-4 text-sm text-muted-foreground">
          {author && (
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                {author.avatar_url && <AvatarImage src={author.avatar_url} />}
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <span>
                {author.first_name} {author.last_name}
              </span>
            </div>
          )}
          {post.published_at && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(post.published_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          )}
          {(post.view_count || 0) > 0 && (
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {post.view_count} views
            </span>
          )}
        </div>

        <Separator className="mb-8" />

        {/* Body */}
        <div className="prose prose-lg dark:prose-invert max-w-none">
          {/* Render body as Markdown-ish content (whitespace preserved) */}
          {post.body.split("\n\n").map((paragraph: string, i: number) => {
            if (paragraph.startsWith("# ")) {
              return (
                <h2 key={i} className="text-2xl font-bold mt-8 mb-4">
                  {paragraph.slice(2)}
                </h2>
              );
            }
            if (paragraph.startsWith("## ")) {
              return (
                <h3 key={i} className="text-xl font-semibold mt-6 mb-3">
                  {paragraph.slice(3)}
                </h3>
              );
            }
            if (paragraph.startsWith("- ") || paragraph.startsWith("* ")) {
              const items = paragraph.split("\n").filter((l) => l.trim());
              return (
                <ul key={i} className="list-disc pl-6 space-y-1 my-4">
                  {items.map((item, j) => (
                    <li key={j}>{item.replace(/^[-*]\s+/, "")}</li>
                  ))}
                </ul>
              );
            }
            return (
              <p key={i} className="my-4 leading-relaxed">
                {paragraph}
              </p>
            );
          })}
        </div>

        <Separator className="my-8" />

        {/* CTA */}
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div>
              <p className="font-semibold">Need medical advice?</p>
              <p className="text-sm text-muted-foreground">
                Book a consultation with one of our verified doctors
              </p>
            </div>
            <Button asChild>
              <Link href="/doctors">Find a Doctor</Link>
            </Button>
          </CardContent>
        </Card>
      </article>
    </div>
  );
}
