"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import type { ExchangeRates } from "@/app/api/exchange-rates/route";

export type DisplayCurrency = "GBP" | "EUR" | "USD";

const DISPLAY_CURRENCIES: DisplayCurrency[] = ["GBP", "EUR", "USD"];

const COOKIE_NAME = "display_currency";
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60; // 1 year

interface CurrencyContextType {
  currency: DisplayCurrency;
  setCurrency: (c: DisplayCurrency) => void;
  rates: ExchangeRates;
  ratesLoaded: boolean;
  convert: (amountCents: number, fromCurrency: string) => number;
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "GBP",
  setCurrency: () => {},
  rates: { GBP: 1, EUR: 1.15, USD: 1.33 },
  ratesLoaded: false,
  convert: (c) => c,
});

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1];
}

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function getDefaultCurrency(locale: string): DisplayCurrency {
  switch (locale) {
    case "en":
      return "GBP";
    case "de":
    case "fr":
    case "it":
    case "es":
    case "pt":
      return "EUR";
    default:
      return "USD";
  }
}

export function CurrencyProvider({
  children,
  locale,
}: {
  children: ReactNode;
  locale: string;
}) {
  const [currency, setCurrencyState] = useState<DisplayCurrency>(() => {
    const saved = getCookie(COOKIE_NAME);
    if (saved && DISPLAY_CURRENCIES.includes(saved as DisplayCurrency)) {
      return saved as DisplayCurrency;
    }
    return getDefaultCurrency(locale);
  });

  const [rates, setRates] = useState<ExchangeRates>({
    GBP: 1,
    EUR: 1.15,
    USD: 1.33,
  });
  const [ratesLoaded, setRatesLoaded] = useState(false);

  // Fetch live rates on mount
  useEffect(() => {
    fetch("/api/exchange-rates")
      .then((r) => r.json())
      .then((data: ExchangeRates) => {
        setRates(data);
        setRatesLoaded(true);
      })
      .catch(() => setRatesLoaded(true)); // use fallback rates
  }, []);

  const setCurrency = useCallback((c: DisplayCurrency) => {
    setCurrencyState(c);
    setCookie(COOKIE_NAME, c, COOKIE_MAX_AGE);
  }, []);

  const convert = useCallback(
    (amountCents: number, fromCurrency: string): number => {
      if (fromCurrency === currency) return amountCents;
      // Convert: from → GBP → target
      const fromRate = rates[fromCurrency] ?? 1;
      const toRate = rates[currency] ?? 1;
      return Math.round((amountCents / fromRate) * toRate);
    },
    [currency, rates]
  );

  return (
    <CurrencyContext.Provider
      value={{ currency, setCurrency, rates, ratesLoaded, convert }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
