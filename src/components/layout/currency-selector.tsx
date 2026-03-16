"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useCurrency, type DisplayCurrency } from "@/providers/currency-provider";

const currencies: { code: DisplayCurrency; flag: string; label: string }[] = [
  { code: "GBP", flag: "🇬🇧", label: "GBP (£)" },
  { code: "EUR", flag: "🇪🇺", label: "EUR (€)" },
  { code: "USD", flag: "🇺🇸", label: "USD ($)" },
];

export function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();
  const current = currencies.find((c) => c.code === currency)!;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 px-2">
          <span className="text-sm">{current.flag}</span>
          <span className="hidden text-xs sm:inline">{current.code}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {currencies.map((c) => (
          <DropdownMenuItem
            key={c.code}
            onClick={() => setCurrency(c.code)}
            className={currency === c.code ? "bg-accent" : ""}
          >
            <span className="mr-2">{c.flag}</span>
            {c.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
