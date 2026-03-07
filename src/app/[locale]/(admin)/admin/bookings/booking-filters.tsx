"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";

export function BookingFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentQ = searchParams.get("q") || "";
  const currentStatus = searchParams.get("status") || "";
  const currentFrom = searchParams.get("from") || "";
  const currentTo = searchParams.get("to") || "";

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString());
    // Preserve tab param
    const tab = params.get("tab");
    const newParams = new URLSearchParams();
    if (tab) newParams.set("tab", tab);
    router.push(`?${newParams.toString()}`);
  }

  const hasFilters = currentQ || currentStatus || currentFrom || currentTo;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search booking #, patient, doctor..."
          defaultValue={currentQ}
          className="w-[270px] pl-9"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              updateFilter("q", (e.target as HTMLInputElement).value);
            }
          }}
          onBlur={(e) => {
            if (e.target.value !== currentQ) {
              updateFilter("q", e.target.value);
            }
          }}
        />
      </div>

      <Select
        value={currentStatus || "all"}
        onValueChange={(val) => updateFilter("status", val)}
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          <SelectItem value="pending_payment">Pending Payment</SelectItem>
          <SelectItem value="pending_approval">Pending Approval</SelectItem>
          <SelectItem value="confirmed">Confirmed</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled_patient">Cancelled (Patient)</SelectItem>
          <SelectItem value="cancelled_doctor">Cancelled (Doctor)</SelectItem>
          <SelectItem value="no_show">No Show</SelectItem>
          <SelectItem value="refunded">Refunded</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>

      <Input
        type="date"
        value={currentFrom}
        onChange={(e) => updateFilter("from", e.target.value)}
        className="w-[150px]"
        placeholder="From date"
      />

      <Input
        type="date"
        value={currentTo}
        onChange={(e) => updateFilter("to", e.target.value)}
        className="w-[150px]"
        placeholder="To date"
      />

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="mr-1 h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
