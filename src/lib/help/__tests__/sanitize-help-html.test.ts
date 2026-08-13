import { describe, expect, it } from "vitest";
import { sanitizeHelpHtml } from "@/lib/help/sanitize-help-html";

describe("sanitizeHelpHtml", () => {
  it("keeps simple formatting tags used in help articles", () => {
    const html =
      "<strong>1.</strong> Book a slot.\n<em>Note</em>";
    const out = sanitizeHelpHtml(html);
    expect(out).toContain("<strong>1.</strong>");
    expect(out).toContain("<em>Note</em>");
  });

  it("strips scripts and event handlers without using jsdom", () => {
    const html =
      '<p onclick="alert(1)">Hi</p><script>alert(2)</script><a href="javascript:alert(3)">x</a>';
    const out = sanitizeHelpHtml(html);
    expect(out.toLowerCase()).not.toContain("script");
    expect(out.toLowerCase()).not.toContain("onclick");
    expect(out.toLowerCase()).not.toContain("javascript:");
    expect(out).toContain("<p>Hi</p>");
  });
});

describe("help-center category SSR", () => {
  it("does not import isomorphic-dompurify", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(
        process.cwd(),
        "src/components/help-center/help-center-category.tsx"
      ),
      "utf8"
    );
    expect(src).toContain("sanitizeHelpHtml");
    expect(src).not.toContain("isomorphic-dompurify");
    expect(src).not.toContain("DOMPurify");
  });
});
