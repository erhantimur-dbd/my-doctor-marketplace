"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ADULT_CONFIRMATION_LABEL } from "@/lib/auth/adult-confirmation";

interface AdultConfirmationCheckboxProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/**
 * Required patient-signup confirmation. The label is fixed legal copy.
 * A hidden field carries the value in a parent form; callers also set it
 * explicitly before invoking the server action.
 */
export function AdultConfirmationCheckbox({
  id,
  checked,
  onCheckedChange,
}: AdultConfirmationCheckboxProps) {
  return (
    <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        aria-required="true"
        className="mt-0.5"
      />
      <input type="hidden" name="adult_confirmed" value={checked ? "true" : "false"} />
      <Label
        htmlFor={id}
        className="text-xs font-normal leading-relaxed text-muted-foreground"
      >
        {ADULT_CONFIRMATION_LABEL}
      </Label>
    </div>
  );
}
