"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { generateCSV, downloadCSV } from "@/lib/utils/csv-export";
import { toast } from "sonner";

interface ExportCSVButtonProps {
  action: () => Promise<{ headers: string[]; rows: (string | number | null)[][]; error?: string }>;
  filename: string;
  label?: string;
}

export function ExportCSVButton({
  action,
  filename,
  label = "Export CSV",
}: ExportCSVButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleExport = () => {
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) {
          toast.error(result.error);
          return;
        }
        const csv = generateCSV(result.headers, result.rows);
        downloadCSV(csv, filename);
        toast.success("CSV exported successfully");
      } catch {
        toast.error("Failed to export CSV");
      }
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isPending}
      className="gap-1.5"
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {label}
    </Button>
  );
}
