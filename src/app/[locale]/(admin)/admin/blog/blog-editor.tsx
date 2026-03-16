"use client";

import { useState, useTransition, useRef, useCallback } from "react";
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
  searchCoverImages,
  type ImageSearchResult,
} from "@/actions/images";
import {
  Save,
  Eye,
  Trash2,
  ArrowLeft,
  X,
  Plus,
  FileText,
  Globe,
  Upload,
  FileUp,
  Search,
  ImageIcon,
  Loader2,
  Check,
  ExternalLink,
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
  const [tags, setTags] = useState<string[]>(() => {
    // Normalise tags loaded from DB — they may have been saved as malformed
    // strings (e.g. entire JSON array as one string, or space-joined)
    const raw = post?.tags || [];
    const cleaned: string[] = [];
    for (const tag of raw) {
      // If a tag looks like a JSON array string, parse it
      if (tag.startsWith("[")) {
        try {
          const parsed = JSON.parse(
            tag.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'")
          );
          if (Array.isArray(parsed)) {
            cleaned.push(
              ...parsed.map((t: unknown) => String(t).trim()).filter(Boolean)
            );
            continue;
          }
        } catch {
          // fall through
        }
      }
      // If a tag contains commas + quotes, it's likely a malformed CSV
      if (tag.includes('",') || tag.includes('", ')) {
        cleaned.push(
          ...tag
            .replace(/^\[|\]$/g, "")
            .split(",")
            .map((t) => t.trim().replace(/^["']+|["']+$/g, ""))
            .filter(Boolean)
        );
        continue;
      }
      cleaned.push(tag.trim());
    }
    // Deduplicate
    return [...new Set(cleaned)];
  });
  const [tagInput, setTagInput] = useState("");
  const [metaTitle, setMetaTitle] = useState(post?.meta_title || "");
  const [metaDescription, setMetaDescription] = useState(
    post?.meta_description || ""
  );
  const [status, setStatus] = useState(post?.status || "draft");

  // Image search state
  const [imageResults, setImageResults] = useState<ImageSearchResult[]>([]);
  const [imageSearchQuery, setImageSearchQuery] = useState("");
  const [imageSearching, setImageSearching] = useState(false);
  const [showImageSearch, setShowImageSearch] = useState(false);

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
    // Support comma-separated input: "Health, Nutrition, Wellness"
    const newTags = tagInput
      .split(",")
      .map((t) => t.trim().replace(/^["']+|["']+$/g, ""))
      .filter((t) => t && !tags.includes(t));
    if (newTags.length > 0) {
      setTags([...tags, ...newTags]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  // ── Image search ──────────────────────────────────────────────────
  const handleImageSearch = async (query?: string) => {
    const searchTerm = query || imageSearchQuery || title;
    if (!searchTerm.trim()) {
      toast.error("Enter a search term or add a title first");
      return;
    }
    setImageSearching(true);
    setShowImageSearch(true);
    setImageSearchQuery(searchTerm);
    const result = await searchCoverImages(searchTerm);
    setImageSearching(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setImageResults(result.images);
    if (result.images.length === 0) {
      toast.info("No images found. Try a different search term.");
    }
  };

  const selectCoverImage = (image: ImageSearchResult) => {
    setCoverImageUrl(image.url);
    setShowImageSearch(false);
    toast.success(`Cover image set — photo by ${image.photographer}`);
  };

  // ── File upload handling ──────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  /** Parsed result from an uploaded file */
  interface ParsedFile {
    title?: string;
    slug?: string;
    excerpt?: string;
    body: string;
    tags?: string[];
    metaTitle?: string;
    metaDescription?: string;
    status?: string;
    locale?: string;
    coverImageUrl?: string;
  }

  /**
   * Parse uploaded file content. Supports:
   * - .txt / .md — read as plain text, extracts frontmatter metadata
   * - .docx — extract text from XML (paragraphs, headings, lists)
   */
  const parseFileContent = useCallback(
    async (file: File): Promise<ParsedFile | null> => {
      const name = file.name.toLowerCase();

      // ── Plain text / Markdown ──
      if (name.endsWith(".txt") || name.endsWith(".md")) {
        const text = await file.text();
        const lines = text.split("\n");
        const meta: Record<string, string> = {};
        let bodyStart = 0;

        // Parse metadata block: lines matching "Key: Value" at the top.
        // Supports multi-word keys like "Meta Title" or "Meta Description".
        // Stops at the first line that doesn't match the pattern (skipping
        // decorative separator lines like "=====" or "BODY (copy...").
        const metaKeyRegex = /^(title|slug|excerpt|tags|meta[_ ]?title|meta[_ ]?description|status|locale|cover[_ ]?image[_ ]?url):\s*(.*)/i;
        const decorativeRegex = /^[=\-~*]{3,}$|^BODY\b/i;

        // Phase 1: scan the header area for metadata key-value lines.
        // Skip decorative/header lines that appear before or between metadata.
        let foundAnyMeta = false;
        let consecutiveNonMeta = 0;

        for (let i = 0; i < lines.length; i++) {
          const trimmed = lines[i].trim();

          // Skip blank lines and decorative separators
          if (trimmed === "" || decorativeRegex.test(trimmed)) {
            bodyStart = i + 1;
            consecutiveNonMeta = 0;
            continue;
          }

          const match = trimmed.match(metaKeyRegex);
          if (match) {
            const key = match[1].toLowerCase().replace(/[\s_]+/g, "_");
            meta[key] = match[2].trim();
            bodyStart = i + 1;
            foundAnyMeta = true;
            consecutiveNonMeta = 0;
          } else if (!foundAnyMeta && !trimmed.includes(":")) {
            // Before any metadata found, skip non-key lines (e.g. "BLOG POST DETAILS")
            bodyStart = i + 1;
            consecutiveNonMeta = 0;
          } else {
            // After metadata section, a non-matching line means body starts
            consecutiveNonMeta++;
            if (consecutiveNonMeta >= 1) break;
          }
        }

        // Skip any remaining blank/decorative lines between metadata and body
        while (bodyStart < lines.length) {
          const trimmed = lines[bodyStart].trim();
          if (trimmed === "" || decorativeRegex.test(trimmed)) {
            bodyStart++;
          } else {
            break;
          }
        }

        // If no metadata title, check for markdown heading as first body line
        if (!meta.title && lines[bodyStart]?.startsWith("# ")) {
          meta.title = lines[bodyStart].replace(/^#+\s*/, "");
          bodyStart++;
        }

        const bodyText = lines.slice(bodyStart).join("\n").trim();

        // Parse tags — supports JSON array ["a","b"] or comma-separated "a, b"
        let parsedTags: string[] | undefined;
        if (meta.tags) {
          // Normalise smart/curly quotes to straight quotes before parsing
          const normalised = meta.tags
            .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"')
            .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
            .trim();
          try {
            const parsed = JSON.parse(normalised);
            if (Array.isArray(parsed)) {
              parsedTags = parsed.map((t) => String(t).trim()).filter(Boolean);
            }
          } catch {
            // Comma-separated fallback — strip brackets and any remaining quotes
            parsedTags = normalised
              .replace(/^\[|\]$/g, "")
              .split(",")
              .map((t) => t.trim().replace(/^["']+|["']+$/g, ""))
              .filter(Boolean);
          }
        }

        return {
          title: meta.title,
          slug: meta.slug,
          excerpt: meta.excerpt,
          body: bodyText,
          tags: parsedTags,
          metaTitle: meta.meta_title || meta.metatitle,
          metaDescription: meta.meta_description || meta.metadescription,
          status: meta.status,
          locale: meta.locale,
          coverImageUrl: meta.cover_image_url || meta.coverimageurl,
        };
      }

      // ── DOCX ──
      if (name.endsWith(".docx")) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const JSZip = (await import("jszip")).default;
          const zip = await JSZip.loadAsync(arrayBuffer);

          const docXml = await zip.file("word/document.xml")?.async("string");
          if (!docXml) {
            toast.error("Could not read document.xml from .docx file");
            return null;
          }

          const parser = new DOMParser();
          const doc = parser.parseFromString(docXml, "application/xml");
          const ns = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

          const paragraphs = doc.getElementsByTagNameNS(ns, "p");
          const result: string[] = [];
          let extractedTitle = "";

          for (let i = 0; i < paragraphs.length; i++) {
            const p = paragraphs[i];
            // Get paragraph style (heading level)
            const pStyle = p.getElementsByTagNameNS(ns, "pStyle")[0];
            const styleVal = pStyle?.getAttribute(`${ns.split("/").pop()}:val`) || pStyle?.getAttribute("w:val") || "";

            // Collect all text runs
            const runs = p.getElementsByTagNameNS(ns, "t");
            let text = "";
            for (let j = 0; j < runs.length; j++) {
              text += runs[j].textContent || "";
            }

            if (!text.trim()) {
              // Preserve blank lines as paragraph separators
              if (result.length > 0 && result[result.length - 1] !== "") {
                result.push("");
              }
              continue;
            }

            // Detect heading styles
            const headingMatch = styleVal.match(/Heading(\d)/i);
            if (headingMatch) {
              const level = parseInt(headingMatch[1]);
              if (level === 1 && !extractedTitle) {
                extractedTitle = text.trim();
                continue; // Don't include H1 in body
              }
              const prefix = level <= 2 ? "# " : "## ";
              result.push(prefix + text.trim());
            }
            // Detect list items
            else if (p.getElementsByTagNameNS(ns, "numPr").length > 0) {
              result.push("- " + text.trim());
            }
            // Regular paragraph
            else {
              if (!extractedTitle && result.length === 0) {
                // First non-empty paragraph could be the title
                extractedTitle = text.trim();
                continue;
              }
              result.push(text.trim());
            }
          }

          // Clean up: collapse multiple blank lines into double newlines
          const bodyText = result
            .join("\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();

          return { title: extractedTitle, body: bodyText };
        } catch (err) {
          console.error("DOCX parse error:", err);
          toast.error("Failed to parse .docx file");
          return null;
        }
      }

      toast.error("Unsupported file type. Use .txt, .md, or .docx");
      return null;
    },
    []
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error("File too large (max 10MB)");
        return;
      }

      const toastId = toast.loading(`Reading ${file.name}...`);
      const result = await parseFileContent(file);
      toast.dismiss(toastId);

      if (!result) return;

      // Populate all fields from parsed metadata
      const populated: string[] = [];

      if (result.title) {
        setTitle(result.title);
        populated.push("title");
      }
      if (result.slug) {
        setSlug(result.slug);
        populated.push("slug");
      } else if (result.title && !post) {
        setSlug(generateSlug(result.title));
        populated.push("slug");
      }
      if (result.excerpt) {
        setExcerpt(result.excerpt);
        populated.push("excerpt");
      }
      if (result.body) {
        setBody(result.body);
        populated.push("body");
      }
      if (result.tags && result.tags.length > 0) {
        setTags(result.tags);
        populated.push("tags");
      }
      if (result.metaTitle) {
        setMetaTitle(result.metaTitle);
        populated.push("meta title");
      }
      if (result.metaDescription) {
        setMetaDescription(result.metaDescription);
        populated.push("meta description");
      }
      if (result.status && ["draft", "published", "archived"].includes(result.status)) {
        setStatus(result.status);
        populated.push("status");
      }
      if (result.locale) {
        setLocale(result.locale);
        populated.push("locale");
      }
      if (result.coverImageUrl) {
        setCoverImageUrl(result.coverImageUrl);
        populated.push("cover image");
      }

      toast.success(
        `Imported "${file.name}" — populated ${populated.length} fields: ${populated.join(", ")}`
      );
    },
    [parseFileContent, post]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

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
        // Hard redirect — router.push inside startTransition can stall
        window.location.href = `/${locale}/admin/blog`;
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

          {/* File Upload */}
          <Card
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={dragOver ? "border-primary border-2 bg-primary/5" : ""}
          >
            <CardContent className="pt-6">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.docx"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = ""; // reset so same file can be re-uploaded
                }}
              />
              <div
                className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 transition-colors hover:border-primary/50 hover:bg-muted/50"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="rounded-full bg-primary/10 p-3">
                  <Upload className="h-6 w-6 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-medium">
                    {dragOver
                      ? "Drop file here..."
                      : "Import from file"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Drag & drop or click to upload — supports{" "}
                    <span className="font-medium">.txt</span>,{" "}
                    <span className="font-medium">.md</span>, and{" "}
                    <span className="font-medium">.docx</span> files
                  </p>
                </div>
                <Button variant="outline" size="sm" type="button">
                  <FileUp className="mr-1.5 h-4 w-4" />
                  Choose File
                </Button>
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
              <CardTitle className="flex items-center gap-2 text-base">
                <ImageIcon className="h-4 w-4" />
                Cover Image
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
              />
              {coverImageUrl && (
                <div className="relative overflow-hidden rounded-md border">
                  <img
                    src={coverImageUrl}
                    alt="Cover preview"
                    className="h-32 w-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <button
                    onClick={() => setCoverImageUrl("")}
                    className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                    aria-label="Remove cover image"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              <Separator />

              {/* Image Search */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Search royalty-free images
                </p>
                <div className="flex gap-1.5">
                  <Input
                    value={imageSearchQuery}
                    onChange={(e) => setImageSearchQuery(e.target.value)}
                    placeholder={title ? `e.g. "${title.split(" ").slice(0, 3).join(" ")}..."` : "Search images..."}
                    className="text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleImageSearch();
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleImageSearch()}
                    disabled={imageSearching}
                    className="shrink-0"
                  >
                    {imageSearching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Quick suggestion chips based on title/tags */}
                {(title || tags.length > 0) && !showImageSearch && (
                  <div className="flex flex-wrap gap-1">
                    {title && (
                      <button
                        onClick={() => handleImageSearch(title.split(":")[0].trim())}
                        className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        {title.split(":")[0].trim().substring(0, 25)}
                        {title.split(":")[0].trim().length > 25 ? "…" : ""}
                      </button>
                    )}
                    {tags.slice(0, 4).map((tag) => (
                      <button
                        key={tag}
                        onClick={() => handleImageSearch(tag)}
                        className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}

                {/* Image results grid */}
                {showImageSearch && (
                  <div className="space-y-2">
                    {imageSearching ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : imageResults.length > 0 ? (
                      <>
                        <div className="grid grid-cols-3 gap-1.5">
                          {imageResults.map((img) => (
                            <button
                              key={img.id}
                              onClick={() => selectCoverImage(img)}
                              className="group relative aspect-[4/3] overflow-hidden rounded-md border hover:ring-2 hover:ring-primary transition-all"
                            >
                              <img
                                src={img.thumbnailUrl}
                                alt={img.alt}
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors">
                                <Check className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                              <div className="absolute bottom-0 left-0 right-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1 pb-0.5 pt-3 text-[9px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                {img.photographer}
                              </div>
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-[10px] text-muted-foreground">
                            Photos from{" "}
                            <a
                              href="https://www.pexels.com"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline hover:text-primary"
                            >
                              Pexels
                            </a>{" "}
                            — free to use
                          </p>
                          <button
                            onClick={() => {
                              setShowImageSearch(false);
                              setImageResults([]);
                            }}
                            className="text-[10px] text-muted-foreground hover:text-primary"
                          >
                            Close
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        No images found. Try a different search.
                      </p>
                    )}
                  </div>
                )}
              </div>
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
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="gap-1 pr-0.5 cursor-default"
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                          aria-label={`Remove tag: ${tag}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  {tags.length > 1 && (
                    <button
                      onClick={() => setTags([])}
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      Clear all tags
                    </button>
                  )}
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
