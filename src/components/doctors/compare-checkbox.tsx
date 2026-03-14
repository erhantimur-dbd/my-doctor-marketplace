"use client";

import { Button } from "@/components/ui/button";
import { GitCompareArrows, Check } from "lucide-react";
import { useDoctorCompareOptional, type CompareDoctor } from "@/hooks/use-doctor-compare";
import { toast } from "sonner";

interface CompareCheckboxProps {
  doctor: CompareDoctor;
  className?: string;
}

export function CompareCheckbox({ doctor, className }: CompareCheckboxProps) {
  const ctx = useDoctorCompareOptional();

  // If no CompareProvider is present, don't render
  if (!ctx) return null;

  const { addToCompare, removeFromCompare, isInCompare, compareList } = ctx;
  const isSelected = isInCompare(doctor.id);

  function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (isSelected) {
      removeFromCompare(doctor.id);
    } else if (compareList.length >= 3) {
      toast.info("You can compare up to 3 doctors at a time");
    } else {
      addToCompare(doctor);
    }
  }

  return (
    <Button
      variant={isSelected ? "default" : "outline"}
      size="sm"
      className={className}
      onClick={handleToggle}
      title={isSelected ? "Remove from comparison" : "Add to comparison"}
    >
      {isSelected ? (
        <Check className="mr-1 h-3.5 w-3.5" />
      ) : (
        <GitCompareArrows className="mr-1 h-3.5 w-3.5" />
      )}
      <span className="text-xs">Compare</span>
    </Button>
  );
}
