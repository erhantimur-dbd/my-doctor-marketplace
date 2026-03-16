import { NextResponse } from "next/server";

export type ExchangeRates = Record<string, number>;

// Fallback rates if Frankfurter API is unavailable
const FALLBACK_RATES: ExchangeRates = {
  GBP: 1.0,
  EUR: 1.15,
  USD: 1.33,
};

let cachedRates: ExchangeRates | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET() {
  const now = Date.now();

  if (cachedRates && now - cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cachedRates, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
  }

  try {
    const res = await fetch(
      "https://api.frankfurter.dev/latest?from=GBP&to=EUR,USD",
      { next: { revalidate: 86400 } }
    );

    if (!res.ok) throw new Error(`Frankfurter API ${res.status}`);

    const data = await res.json();
    const rates: ExchangeRates = {
      GBP: 1.0,
      EUR: data.rates.EUR,
      USD: data.rates.USD,
    };

    cachedRates = rates;
    cachedAt = now;

    return NextResponse.json(rates, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
  } catch {
    return NextResponse.json(cachedRates ?? FALLBACK_RATES, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }
}
