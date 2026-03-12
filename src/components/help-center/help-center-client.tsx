"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { BookOpen, Search, X, Mail, ArrowRight, Stethoscope, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import { getHelpCategories } from "./help-center-data";
import { HelpCenterCategory } from "./help-center-category";
import type { HelpCategory } from "./help-center-data";

const supportEmail =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@mydoctors360.com";

function filterCategoriesForAudience(
  categories: HelpCategory[],
  audience: "patient" | "doctor",
  query: string
): HelpCategory[] {
  let cats = categories.map((category) => ({
    ...category,
    articles: category.articles.filter(
      (article) => article.audience === audience || article.audience === "all"
    ),
  }));

  if (query) {
    const q = query.toLowerCase();
    cats = cats.map((category) => ({
      ...category,
      articles: category.articles.filter(
        (article) =>
          article.question.toLowerCase().includes(q) ||
          article.answer.toLowerCase().includes(q) ||
          article.tags.some((tag) => tag.toLowerCase().includes(q))
      ),
    }));
  }

  return cats.filter((category) => category.articles.length > 0);
}

export function HelpCenterClient() {
  const t = useTranslations("helpCenter");
  const tArticles = useTranslations("helpArticles");
  const helpCategories = useMemo(
    () => getHelpCategories(
      (k) => t(k),
      (k) => tArticles(k),
      (k) => tArticles.raw(k) as string
    ),
    [t, tArticles]
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [openArticleId, setOpenArticleId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"patient" | "doctor">("patient");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Hash anchor handling on mount — detect which tab the article belongs to
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      // Find which audience the article belongs to and switch tab
      for (const cat of helpCategories) {
        const article = cat.articles.find((a) => a.id === hash);
        if (article) {
          if (article.audience === "doctor") {
            setActiveTab("doctor");
          } else {
            setActiveTab("patient");
          }
          break;
        }
      }
      setOpenArticleId(hash);
      const timer = setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [helpCategories]);

  // Filtered categories per tab
  const patientCategories = useMemo(
    () => filterCategoriesForAudience(helpCategories, "patient", debouncedQuery),
    [helpCategories, debouncedQuery]
  );

  const doctorCategories = useMemo(
    () => filterCategoriesForAudience(helpCategories, "doctor", debouncedQuery),
    [helpCategories, debouncedQuery]
  );

  const activeCategories = activeTab === "patient" ? patientCategories : doctorCategories;

  const totalResults = useMemo(
    () => activeCategories.reduce((sum, cat) => sum + cat.articles.length, 0),
    [activeCategories]
  );

  const scrollToCategory = useCallback((categoryId: string) => {
    const el = document.getElementById(categoryId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  const renderCategoryCards = (categories: HelpCategory[]) => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {categories.map((category) => {
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
              <h3 className="text-sm font-semibold">{category.title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("articles_count", { count: category.articles.length })}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );

  const renderArticles = (categories: HelpCategory[], audience: "patient" | "doctor") => (
    <div className="space-y-8">
      {categories.length > 0 ? (
        categories.map((category) => (
          <HelpCenterCategory
            key={category.id}
            category={category}
            searchQuery={debouncedQuery}
            audience={audience}
            openArticleId={
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
            {t("no_results_clear")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("no_results_clear_hint")}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => setSearchQuery("")}
          >
            {t("clear_search")}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-16 md:py-24">
        <div className="container mx-auto text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <BookOpen className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            {t("title")}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {t("subtitle")}
          </p>

          {/* Search */}
          <div className="mx-auto mt-8 max-w-xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t("search_placeholder")}
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
                    {t("articles_found", {
                      count: totalResults,
                      query: debouncedQuery,
                    })}
                  </>
                ) : (
                  <>
                    {t("no_results", { query: debouncedQuery })}{" "}
                    {t("no_results_hint")}{" "}
                    <Link
                      href="/support"
                      className="text-primary underline underline-offset-4"
                    >
                      {t("contact_support_link")}
                    </Link>
                    .
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Tabbed Content */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as "patient" | "doctor");
          setOpenArticleId(null);
        }}
        className="w-full"
      >
        {/* Sticky Tab Bar */}
        <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex justify-center px-4 py-3">
            <TabsList className="h-11 rounded-full bg-muted p-1">
              <TabsTrigger
                value="patient"
                className="flex items-center gap-2 rounded-full px-6 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <User className="h-4 w-4" />
                {t("tab_patient")}
              </TabsTrigger>
              <TabsTrigger
                value="doctor"
                className="flex items-center gap-2 rounded-full px-6 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Stethoscope className="h-4 w-4" />
                {t("tab_doctor")}
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Patient Tab */}
        <TabsContent value="patient" className="mt-0">
          {/* Quick-Nav */}
          {!debouncedQuery && patientCategories.length > 0 && (
            <section className="px-4 py-12 md:py-16">
              <div className="container mx-auto max-w-5xl">
                <div className="mb-6 text-center">
                  <h2 className="text-xl font-semibold">{t("patient_section_title")}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t("patient_section_desc")}</p>
                </div>
                {renderCategoryCards(patientCategories)}
              </div>
            </section>
          )}
          {/* Articles */}
          <section className="bg-muted/30 px-4 py-12 md:py-16">
            <div className="container mx-auto max-w-3xl">
              {renderArticles(patientCategories, "patient")}
            </div>
          </section>
        </TabsContent>

        {/* Doctor Tab */}
        <TabsContent value="doctor" className="mt-0">
          {/* Quick-Nav */}
          {!debouncedQuery && doctorCategories.length > 0 && (
            <section className="px-4 py-12 md:py-16">
              <div className="container mx-auto max-w-5xl">
                <div className="mb-6 text-center">
                  <h2 className="text-xl font-semibold">{t("doctor_section_title")}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t("doctor_section_desc")}</p>
                </div>
                {renderCategoryCards(doctorCategories)}
              </div>
            </section>
          )}
          {/* Articles */}
          <section className="bg-muted/30 px-4 py-12 md:py-16">
            <div className="container mx-auto max-w-3xl">
              {renderArticles(doctorCategories, "doctor")}
            </div>
          </section>
        </TabsContent>
      </Tabs>

      {/* Still Need Help? CTA */}
      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-bold md:text-3xl">
            {t("still_need_help")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            {t("still_need_help_desc")}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" className="rounded-full" asChild>
              <a href={`mailto:${supportEmail}`}>
                {t("contact_support")} <Mail className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full"
              asChild
            >
              <Link href="/support">
                {t("support_options")} <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
