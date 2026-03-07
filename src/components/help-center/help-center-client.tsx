"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { BookOpen, Search, X, Mail, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { helpCategories } from "./help-center-data";
import { HelpCenterCategory } from "./help-center-category";

const supportEmail =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@mydoctors360.com";

export function HelpCenterClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Hash anchor handling on mount
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      setOpenArticleId(hash);
      // Wait for DOM to render, then scroll
      const timer = setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, []);

  // Filtered categories based on search
  const filteredCategories = useMemo(() => {
    if (!debouncedQuery) return helpCategories;
    const q = debouncedQuery.toLowerCase();
    return helpCategories
      .map((category) => ({
        ...category,
        articles: category.articles.filter(
          (article) =>
            article.question.toLowerCase().includes(q) ||
            article.answer.toLowerCase().includes(q) ||
            article.tags.some((tag) => tag.toLowerCase().includes(q))
        ),
      }))
      .filter((category) => category.articles.length > 0);
  }, [debouncedQuery]);

  const totalResults = useMemo(
    () => filteredCategories.reduce((sum, cat) => sum + cat.articles.length, 0),
    [filteredCategories]
  );

  const scrollToCategory = useCallback((categoryId: string) => {
    const el = document.getElementById(categoryId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-16 md:py-24">
        <div className="container mx-auto text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            Help Center
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Find guides, troubleshooting tips, and answers to common questions
            about booking, calendar sync, payments, and more.
          </p>

          {/* Search */}
          <div className="mx-auto mt-8 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search for help articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 rounded-full pl-10 pr-10 text-base"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {debouncedQuery && (
              <p className="mt-3 text-sm text-muted-foreground">
                {totalResults > 0 ? (
                  <>
                    <Badge variant="secondary" className="mr-1">
                      {totalResults}
                    </Badge>
                    {totalResults === 1 ? "article" : "articles"} found for
                    &ldquo;{debouncedQuery}&rdquo;
                  </>
                ) : (
                  <>
                    No articles found for &ldquo;{debouncedQuery}&rdquo;. Try
                    different keywords or{" "}
                    <Link
                      href="/support"
                      className="text-primary underline underline-offset-4"
                    >
                      contact support
                    </Link>
                    .
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Category Quick-Nav Cards */}
      {!debouncedQuery && (
        <section className="px-4 py-12 md:py-16">
          <div className="container mx-auto max-w-5xl">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {helpCategories.map((category) => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.id}
                    onClick={() => scrollToCategory(category.id)}
                    className={`group flex flex-col items-center gap-3 rounded-xl border p-6 text-center transition-all hover:shadow-md ${category.color.border} hover:${category.color.bg}`}
                  >
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${category.color.bg}`}
                    >
                      <Icon className={`h-6 w-6 ${category.color.text}`} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">
                        {category.title}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {category.articles.length} articles
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Category Sections */}
      <section
        className={`bg-muted/30 px-4 py-12 md:py-16 ${debouncedQuery ? "mt-0" : ""}`}
      >
        <div className="container mx-auto max-w-3xl space-y-8">
          {filteredCategories.length > 0 ? (
            filteredCategories.map((category) => (
              <HelpCenterCategory
                key={category.id}
                category={category}
                searchQuery={debouncedQuery}
                openArticleId={
                  // Only pass if this category owns the article
                  category.articles.some((a) => a.id === openArticleId)
                    ? openArticleId
                    : null
                }
                onArticleToggle={(id) => {
                  setOpenArticleId(id);
                  if (id) {
                    window.history.replaceState(null, "", `#${id}`);
                  }
                }}
              />
            ))
          ) : (
            <div className="py-12 text-center">
              <p className="text-lg font-medium text-muted-foreground">
                No articles match your search.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Try different keywords or browse all categories.
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setSearchQuery("")}
              >
                Clear search
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Still Need Help? CTA */}
      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-bold md:text-3xl">Still Need Help?</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Can&apos;t find what you&apos;re looking for? Our support team is
            here to help.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" className="rounded-full" asChild>
              <a href={`mailto:${supportEmail}`}>
                Contact Support <Mail className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full"
              asChild
            >
              <Link href="/support">
                Support Options <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
