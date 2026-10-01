/**
 * Storage keys are `{conversationId}/{timestamp}_{name}`. A client-supplied
 * name with slashes or `..` would add extra path segments. Keep a single
 * safe file name.
 */
export function safeAttachmentObjectName(originalName: string): string {
  const base = originalName.split(/[/\\]/).pop() || "file";
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "");
  const trimmed = cleaned.slice(0, 80);
  return trimmed.length > 0 ? trimmed : "file";
}
