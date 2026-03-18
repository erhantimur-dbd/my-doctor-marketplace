"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface AuditMetadataCellProps {
  metadata: Record<string, unknown> | null;
}

export function AuditMetadataCell({ metadata }: AuditMetadataCellProps) {
  const [expanded, setExpanded] = useState(false);

  if (!metadata || Object.keys(metadata).length === 0) {
    return <span className="text-xs text-muted-foreground">&mdash;</span>;
  }

  const entries = Object.entries(metadata);
  const preview = entries
    .slice(0, 2)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ");

  if (entries.length <= 2 && preview.length < 60) {
    return (
      <span className="text-xs text-muted-foreground" title={JSON.stringify(metadata, null, 2)}>
        {preview}
      </span>
    );
  }

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {expanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        {expanded ? "Collapse" : `${entries.length} fields`}
      </button>
      {expanded && (
        <pre className="mt-1 max-h-48 overflow-auto rounded bg-muted p-2 text-[11px] leading-relaxed">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}
