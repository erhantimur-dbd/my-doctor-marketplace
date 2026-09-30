"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";
import { useCurrency } from "@/providers/currency-provider";
import { enabledDisplayCurrencyOptions } from "@/lib/billing/display-currency";

export function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();
  const options = enabledDisplayCurrencyOptions();
  if (options.length < 2) return null;

  const current = options.find((c) => c.code === currency) ?? options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 px-2 text-muted-foreground hover:text-foreground">
          <span className="text-sm font-medium">{current.code}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((c) => (
          <DropdownMenuItem
            key={c.code}
            onClick={() => setCurrency(c.code)}
            className={currency === c.code ? "bg-accent" : ""}
          >
            <span className="mr-2 text-muted-foreground">{c.symbol}</span>
            {c.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
