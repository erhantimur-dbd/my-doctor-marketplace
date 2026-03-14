"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, X, FileText, Image, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

interface PendingFile {
  file: File;
  preview?: string;
}

interface FileUploadButtonProps {
  onFileSelect: (file: File) => void;
  pendingFile: PendingFile | null;
  onClear: () => void;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileUploadButton({
  onFileSelect,
  pendingFile,
  onClear,
  disabled,
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large. Maximum size is 10MB.");
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Unsupported file type. Allowed: images, PDF, Word documents.");
      return;
    }

    onFileSelect(file);

    // Reset input so the same file can be selected again
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={ALLOWED_TYPES.join(",")}
        onChange={handleChange}
      />
      {pendingFile ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
          {pendingFile.file.type.startsWith("image/") ? (
            <Image className="h-4 w-4 shrink-0 text-blue-500" />
          ) : (
            <FileText className="h-4 w-4 shrink-0 text-orange-500" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">
              {pendingFile.file.name}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {formatFileSize(pendingFile.file.size)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="rounded-full p-1 hover:bg-muted-foreground/20"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
