"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Download, Image, Loader2 } from "lucide-react";
import { getAttachmentUrl } from "@/actions/attachments";

interface AttachmentData {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(fileType: string): boolean {
  return fileType.startsWith("image/");
}

export function AttachmentPreview({
  attachment,
  isMine,
}: {
  attachment: AttachmentData;
  isMine: boolean;
}) {
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      const result = await getAttachmentUrl(attachment.storagePath);
      if (result.url) {
        window.open(result.url, "_blank");
      }
    } catch {
      // Silently handle error
    }
    setDownloading(false);
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className={`mt-1.5 flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-background/10 ${
        isMine
          ? "border-primary-foreground/20"
          : "border-border"
      }`}
    >
      {isImage(attachment.fileType) ? (
        <Image className="h-4 w-4 shrink-0" />
      ) : (
        <FileText className="h-4 w-4 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate">{attachment.fileName}</p>
        <p className={`text-[10px] ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
          {formatFileSize(attachment.fileSize)}
        </p>
      </div>
      {downloading ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5 shrink-0 opacity-60" />
      )}
    </button>
  );
}
