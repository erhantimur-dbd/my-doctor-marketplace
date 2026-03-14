"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MonthlyBarChartProps {
  data: { month: string; value: number }[];
  color?: string;
  /** Format the tooltip/axis value */
  formatValue?: (value: number) => string;
  /** Chart height in pixels */
  height?: number;
}

export function MonthlyBarChart({
  data,
  color = "hsl(var(--primary))",
  formatValue,
  height = 240,
}: MonthlyBarChartProps) {
  const formatter = formatValue || ((v: number) => String(v));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          className="text-xs fill-muted-foreground"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          className="text-xs fill-muted-foreground"
          tickFormatter={formatter}
          width={50}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--popover))",
            color: "hsl(var(--popover-foreground))",
            fontSize: "13px",
          }}
          formatter={(value: any) => [formatter(Number(value)), ""]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Bar
          dataKey="value"
          fill={color}
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
