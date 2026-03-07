"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function PaymentFilters({
  from,
  to,
}: {
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fromDate, setFromDate] = useState(from || "");
  const [toDate, setToDate] = useState(to || "");

  function handleApply() {
    const params = new URLSearchParams(searchParams.toString());
    if (fromDate) {
      params.set("from", fromDate);
    } else {
      params.delete("from");
    }
    if (toDate) {
      params.set("to", toDate);
    } else {
      params.delete("to");
    }
    router.push(`?${params.toString()}`);
  }

  function handleClear() {
    setFromDate("");
    setToDate("");
    router.push("?");
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-4 p-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="filter-from"
            className="text-sm font-medium text-muted-foreground"
          >
            From
          </label>
          <input
            id="filter-from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="filter-to"
            className="text-sm font-medium text-muted-foreground"
          >
            To
          </label>
          <input
            id="filter-to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <Button onClick={handleApply} size="sm">
          Apply
        </Button>
        {(from || to) && (
          <Button onClick={handleClear} variant="outline" size="sm">
            Clear
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
