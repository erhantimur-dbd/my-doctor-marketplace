/**
 * Simple linear regression for revenue forecasting.
 * Pure math — no external dependencies.
 *
 * Usage:
 *   import { forecast } from "@/lib/utils/forecast";
 *   const result = forecast([100, 120, 140, 160], 3);
 *   // result.predicted = [~180, ~200, ~220]
 *   // result.r2 = 0.99 (high confidence)
 */

interface RegressionResult {
  slope: number;
  intercept: number;
  r2: number;
}

/**
 * Least-squares linear regression.
 * x values are indices (0, 1, 2, ...), y values are the input data.
 */
export function linearRegression(data: number[]): RegressionResult {
  const n = data.length;
  if (n < 2) return { slope: 0, intercept: data[0] || 0, r2: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += data[i];
    sumXY += i * data[i];
    sumX2 += i * i;
    sumY2 += data[i] * data[i];
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R-squared (coefficient of determination)
  const meanY = sumY / n;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * i + intercept;
    ssRes += (data[i] - predicted) ** 2;
    ssTot += (data[i] - meanY) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);

  return { slope, intercept, r2 };
}

interface ForecastResult {
  predicted: number[];
  slope: number;
  intercept: number;
  r2: number;
  trend: "up" | "down" | "flat";
}

/**
 * Forecast future values using linear regression.
 * @param data Historical data points (e.g., monthly revenue)
 * @param periods Number of future periods to predict
 * @returns Predicted values + regression stats
 */
export function forecast(data: number[], periods: number): ForecastResult {
  const { slope, intercept, r2 } = linearRegression(data);
  const n = data.length;

  const predicted: number[] = [];
  for (let i = 0; i < periods; i++) {
    const value = slope * (n + i) + intercept;
    predicted.push(Math.max(0, Math.round(value))); // No negative revenue
  }

  const trend: "up" | "down" | "flat" =
    slope > 0.01 * (intercept || 1) ? "up" :
    slope < -0.01 * (intercept || 1) ? "down" :
    "flat";

  return { predicted, slope, intercept, r2, trend };
}

/**
 * Calculate booking velocity — average bookings per week.
 * @param recentWeekCounts Array of booking counts per week (newest first)
 * @returns { current, previous, changePercent, trend }
 */
export function bookingVelocity(
  recentWeekCounts: number[]
): {
  current: number;
  previous: number;
  changePercent: number;
  trend: "up" | "down" | "flat";
} {
  const current =
    recentWeekCounts.slice(0, 4).reduce((a, b) => a + b, 0) /
    Math.min(4, recentWeekCounts.length);
  const previous =
    recentWeekCounts.slice(4, 8).reduce((a, b) => a + b, 0) /
    Math.min(4, recentWeekCounts.slice(4).length || 1);

  const changePercent =
    previous === 0
      ? current > 0
        ? 100
        : 0
      : Math.round(((current - previous) / previous) * 100);

  const trend: "up" | "down" | "flat" =
    changePercent > 5 ? "up" : changePercent < -5 ? "down" : "flat";

  return { current: Math.round(current * 10) / 10, previous: Math.round(previous * 10) / 10, changePercent, trend };
}
