const ALLOWED = new Set(["strong", "em", "b", "i", "br", "p", "ul", "ol", "li"]);

/**
 * Allowlist sanitizer for help-article HTML. Avoids isomorphic-dompurify/jsdom
 * so the help-center page can SSR on Vercel without crashing.
 */
export function sanitizeHelpHtml(input: string): string {
  if (typeof input !== "string" || input.length === 0) return "";

  let s = input.replace(
    /<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi,
    ""
  );
  s = s.replace(/<\/?(?:script|style)\b[^>]*>/gi, "");
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  return s.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?>/g, (full, tag: string, attrs?: string) => {
    const name = tag.toLowerCase();
    const closing = full.startsWith("</");
    if (name === "a") {
      if (closing) return "</a>";
      const hrefMatch = /href\s*=\s*(['"])(.*?)\1/i.exec(attrs || "");
      const url = (hrefMatch?.[2] || "").trim();
      if (/^https?:\/\//i.test(url) || url.startsWith("/")) {
        return `<a href="${url.replace(/"/g, "")}">`;
      }
      return "";
    }
    if (!ALLOWED.has(name)) return "";
    if (closing) return `</${name}>`;
    if (name === "br") return "<br>";
    return `<${name}>`;
  });
}
