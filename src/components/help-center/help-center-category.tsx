"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link2 } from "lucide-react";
import type { HelpCategory } from "./help-center-data";

interface HelpCenterCategoryProps {
  category: HelpCategory;
  searchQuery: string;
  openArticleId: string | null;
  onArticleToggle: (articleId: string | null) => void;
}

const audienceLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  doctor: { label: "For Doctors", variant: "default" },
  patient: { label: "For Patients", variant: "secondary" },
  all: { label: "Everyone", variant: "outline" },
};

export function HelpCenterCategory({
  category,
  searchQuery,
  openArticleId,
  onArticleToggle,
}: HelpCenterCategoryProps) {
  const Icon = category.icon;

  const filteredArticles = searchQuery
    ? category.articles.filter((article) => {
        const q = searchQuery.toLowerCase();
        return (
          article.question.toLowerCase().includes(q) ||
          article.answer.toLowerCase().includes(q) ||
          article.tags.some((tag) => tag.toLowerCase().includes(q))
        );
      })
    : category.articles;

  if (filteredArticles.length === 0) return null;

  const copyLink = (articleId: string) => {
    const url = `${window.location.origin}${window.location.pathname}#${articleId}`;
    navigator.clipboard.writeText(url);
    window.history.replaceState(null, "", `#${articleId}`);
  };

  return (
    <section id={category.id} className="scroll-mt-24">
      <Card className={`border ${category.color.border}`}>
        <CardHeader
          className={`${category.color.bg} rounded-t-lg border-b ${category.color.border}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-lg ${category.color.bg}`}
            >
              <Icon className={`h-5 w-5 ${category.color.text}`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">{category.title}</h2>
              <p className="text-sm text-muted-foreground">
                {category.description}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 py-2">
          <Accordion
            type="single"
            collapsible
            value={openArticleId ?? ""}
            onValueChange={(val) => onArticleToggle(val || null)}
          >
            {filteredArticles.map((article) => {
              const audience = audienceLabels[article.audience];
              return (
                <AccordionItem
                  key={article.id}
                  value={article.id}
                  id={article.id}
                  className="scroll-mt-24"
                >
                  <AccordionTrigger className="text-left">
                    <div className="flex items-center gap-2 pr-2">
                      <span className="font-medium">{article.question}</span>
                      {article.audience !== "all" && (
                        <Badge
                          variant={audience.variant}
                          className="shrink-0 text-[10px]"
                        >
                          {audience.label}
                        </Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div
                      className="prose prose-sm max-w-none text-muted-foreground dark:prose-invert [&_strong]:text-foreground"
                      dangerouslySetInnerHTML={{
                        __html: article.answer.replace(/\n/g, "<br />"),
                      }}
                    />
                    <button
                      onClick={() => copyLink(article.id)}
                      className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground/60 transition-colors hover:text-primary"
                      title="Copy link to this article"
                    >
                      <Link2 className="h-3 w-3" />
                      Copy link
                    </button>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>
    </section>
  );
}
