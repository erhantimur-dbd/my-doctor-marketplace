"use client";

import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

interface PrintButtonProps {
  className?: string;
  label?: string;
}

export function PrintButton({
  className = "w-full",
  label = "Print",
}: PrintButtonProps) {
  return (
    <Button
      variant="outline"
      className={className}
      data-print-hide
      onClick={() => window.print()}
    >
      <Printer className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
