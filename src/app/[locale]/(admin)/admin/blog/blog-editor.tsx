"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  type BlogPostInput,
} from "@/actions/blog";
import {
  Save,
  Eye,
  Trash2,
  ArrowLeft,
  X,
  Plus,
  FileText,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";

interface BlogEditorProps {
  post?: {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    body: string;
    locale: string;
    cover_image_url: string | null;
    tags: string[] | null;
    meta_title: string | null;
    meta_description: string | null;
    status: string;
  };
}

export function BlogEditor({ post }: BlogEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(post?.title || "");
  const [slug, setSlug] = useState(post?.slug || "");
  const [excerpt, setExcerpt] = useState(post?.excerpt || "");
  const [body, setBody] = useState(post?.body || "");
  const [locale, setLocale] = useState(post?.locale || "en");
  const [coverImageUrl, setCoverImageUrl] = useState(
    post?.cover_image_url || ""
  );
  const [tags, setTags] = useState<string[]>(post?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [metaTitle, setMetaTitle] = useState(post?.meta_title || "");
  const [metaDescription, setMetaDescription] = useState(
    post?.meta_description || ""
  );
  const [status, setStatus] = useState(post?.status || "draft");

  // Auto-generate slug from title
  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 200);
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!post) {
      setSlug(generateSlug(value));
    }
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = (saveStatus: string) => {
    if (!title.trim() || !slug.trim() || !body.trim()) {
      toast.error("Title, slug, and body are required");
      return;
    }

    startTransition(async () => {
      const input: BlogPostInput = {
        title: title.trim(),
        slug: slug.trim(),
        excerpt: excerpt.trim() || null,
        body: body.trim(),
        locale,
        cover_image_url: coverImageUrl.trim() || null,
        tags,
        meta_title: metaTitle.trim() || null,
        meta_description: metaDescription.trim() || null,
        status: saveStatus as "draft" | "published" | "archived",
      };

      if (post) {
        const result = await updateBlogPost(post.id, input);
        if (result.error) {
          toast.error(result.error);
        } else {
          setStatus(saveStatus);
          toast.success(
            saveStatus === "published"
              ? "Article published!"
              : "Article saved as draft"
          );
          router.refresh();
        }
      } else {
        const result = await createBlogPost(input);
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(
            saveStatus === "published"
              ? "Article published!"
              : "Draft created!"
          );
          router.push(`/admin/blog/${result.post?.id}`);
          router.refresh();
        }
      }
    });
  };

  const handleDelete = () => {
    if (!post) return;
    if (!confirm("Are you sure you want to delete this article? This cannot be undone.")) return;

    startTransition(async () => {
      const result = await deleteBlogPost(post.id);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Article deleted");
        router.push("/admin/blog");
        router.refresh();
      }
    });
  };

  // Simple body preview (matches the blog renderer)
  const previewParagraphs = body.split("\n\n").filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/blog">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">
              {post ? "Edit Article" : "New Article"}
            </h1>
            {post && (
              <p className="text-sm text-muted-foreground">
                /{post.slug}
                {status === "published" && " (published)"}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {post && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isPending}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              Delete
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => handleSave("draft")}
            disabled={isPending}
          >
            <Save className="mr-1.5 h-4 w-4" />
            {isPending ? "Saving..." : "Save Draft"}
          </Button>
          <Button
            onClick={() => handleSave("published")}
            disabled={isPending}
          >
            <Eye className="mr-1.5 h-4 w-4" />
            {isPending ? "Publishing..." : "Publish"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main editor — 2/3 width */}
        <div className="space-y-6 lg:col-span-2">
          {/* Title & Slug */}
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Article title..."
                  className="text-lg font-semibold"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">/blog/</span>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="article-slug"
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="excerpt">Excerpt</Label>
                <Textarea
                  id="excerpt"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="Brief summary for listing cards (max 500 characters)..."
                  rows={2}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {excerpt.length}/500
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Body */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Article Body
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Use <code className="rounded bg-muted px-1"># Heading</code> for
                sections,{" "}
                <code className="rounded bg-muted px-1">## Subheading</code> for
                subsections, and{" "}
                <code className="rounded bg-muted px-1">- item</code> for bullet
                lists. Separate paragraphs with blank lines.
              </p>
            </CardHeader>
            <CardContent>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your article here...

# Section Heading

Your paragraph text goes here. Separate paragraphs with a blank line.

## Subsection

- Bullet point 1
- Bullet point 2"
                rows={24}
                className="font-mono text-sm leading-relaxed"
              />
              <p className="mt-2 text-xs text-muted-foreground text-right">
                {body.length.toLocaleString()} characters &middot;{" "}
                ~{Math.ceil(body.split(/\s+/).filter(Boolean).length / 250)} min
                read
              </p>
            </CardContent>
          </Card>

          {/* Preview */}
          {body.trim() && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Eye className="h-4 w-4" />
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {previewParagraphs.map((paragraph, i) => {
                    if (paragraph.startsWith("# ")) {
                      return (
                        <h2 key={i} className="text-xl font-bold mt-6 mb-3">
                          {paragraph.slice(2)}
                        </h2>
                      );
                    }
                    if (paragraph.startsWith("## ")) {
                      return (
                        <h3 key={i} className="text-lg font-semibold mt-4 mb-2">
                          {paragraph.slice(3)}
                        </h3>
                      );
                    }
                    if (
                      paragraph.startsWith("- ") ||
                      paragraph.startsWith("* ")
                    ) {
                      const items = paragraph.split("\n").filter((l) => l.trim());
                      return (
                        <ul key={i} className="list-disc pl-6 space-y-1 my-3">
                          {items.map((item, j) => (
                            <li key={j}>{item.replace(/^[-*]\s+/, "")}</li>
                          ))}
                        </ul>
                      );
                    }
                    return (
                      <p key={i} className="my-3 leading-relaxed text-sm">
                        {paragraph}
                      </p>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar — 1/3 width */}
        <div className="space-y-6">
          {/* Status & Locale */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  <Globe className="mr-1.5 inline h-3.5 w-3.5" />
                  Locale
                </Label>
                <Select value={locale} onValueChange={setLocale}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="tr">Turkce</SelectItem>
                    <SelectItem value="fr">Francais</SelectItem>
                    <SelectItem value="es">Espanol</SelectItem>
                    <SelectItem value="it">Italiano</SelectItem>
                    <SelectItem value="pt">Portugues</SelectItem>
                    <SelectItem value="ja">Japanese</SelectItem>
                    <SelectItem value="zh">Chinese</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Cover Image */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cover Image</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
              {coverImageUrl && (
                <div className="overflow-hidden rounded-md border">
                  <img
                    src={coverImageUrl}
                    alt="Cover preview"
                    className="h-32 w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tags */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Add tag..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={addTag}
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* SEO */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">SEO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="metaTitle">Meta Title</Label>
                <Input
                  id="metaTitle"
                  value={metaTitle}
                  onChange={(e) => setMetaTitle(e.target.value)}
                  placeholder="SEO title (max 100 chars)"
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {metaTitle.length}/100
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaDesc">Meta Description</Label>
                <Textarea
                  id="metaDesc"
                  value={metaDescription}
                  onChange={(e) => setMetaDescription(e.target.value)}
                  placeholder="SEO description (max 300 chars)"
                  rows={3}
                  maxLength={300}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {metaDescription.length}/300
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
