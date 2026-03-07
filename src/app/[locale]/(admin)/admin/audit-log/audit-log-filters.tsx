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

const ACTION_TYPES = [
  { value: "all", label: "All Actions" },
  { value: "doctor_verification", label: "Doctor Verification" },
  { value: "doctor_activated", label: "Doctor Activated" },
  { value: "doctor_deactivated", label: "Doctor Deactivated" },
  { value: "doctor_featured", label: "Doctor Featured" },
  { value: "doctor_profile_updated", label: "Doctor Profile Updated" },
  { value: "review_approved", label: "Review Approved" },
  { value: "review_hidden", label: "Review Hidden" },
  { value: "booking_refunded", label: "Booking Refunded" },
  { value: "booking_status", label: "Booking Status Change" },
  { value: "patient_suspended", label: "Patient Suspended" },
  { value: "patient_unsuspended", label: "Patient Unsuspended" },
  { value: "patient_password_reset", label: "Password Reset" },
  { value: "admin_email_sent", label: "Admin Email Sent" },
  { value: "coupon", label: "Coupon Actions" },
  { value: "setting_updated", label: "Settings Updated" },
  { value: "subscription_upgrade", label: "Subscription Invite" },
];

export function AuditLogFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentAction = searchParams.get("action") || "";
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

  const hasFilters = currentAction || currentFrom || currentTo;

  function clearFilters() {
    router.push("?");
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={currentAction || "all"}
        onValueChange={(val) => updateFilter("action", val)}
      >
        <SelectTrigger className="w-52">
          <SelectValue placeholder="Action type" />
        </SelectTrigger>
        <SelectContent>
          {ACTION_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={currentFrom}
          onChange={(e) => updateFilter("from", e.target.value)}
          className="w-40"
          placeholder="From date"
        />
        <span className="text-muted-foreground">to</span>
        <Input
          type="date"
          value={currentTo}
          onChange={(e) => updateFilter("to", e.target.value)}
          className="w-40"
          placeholder="To date"
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
          <X className="h-3.5 w-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
