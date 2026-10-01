import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { safeAttachmentObjectName } from "@/lib/messages/attachment-name";

describe("safeAttachmentObjectName", () => {
  it("drops path segments and parent traversal", () => {
    expect(safeAttachmentObjectName("../../other/secret.pdf")).toBe("secret.pdf");
    expect(safeAttachmentObjectName("..\\..\\secret.pdf")).toBe("secret.pdf");
    expect(safeAttachmentObjectName("folder/report.pdf")).toBe("report.pdf");
  });

  it("replaces characters that are not safe in a single path segment", () => {
    expect(safeAttachmentObjectName("my file (1).pdf")).toBe("my_file__1_.pdf");
  });

  it("falls back when the name is empty or only dots", () => {
    expect(safeAttachmentObjectName("")).toBe("file");
    expect(safeAttachmentObjectName("...")).toBe("file");
  });
});

describe("upload path", () => {
  it("builds the storage key from the sanitised name", () => {
    const src = readFileSync(
      join(process.cwd(), "src/actions/attachments.ts"),
      "utf8"
    );
    expect(src).toContain("safeAttachmentObjectName(file.name)");
    expect(src).not.toContain("${timestamp}_${file.name}");
  });
});
