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

interface DayOfWeekChartProps {
  data: { day: string; count: number }[];
  color?: string;
  height?: number;
}

export function DayOfWeekChart({
  data,
  color = "#6366f1",
  height = 180,
}: DayOfWeekChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          className="text-xs fill-muted-foreground"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          className="text-xs fill-muted-foreground"
          allowDecimals={false}
          width={30}
        />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid hsl(var(--border))",
            background: "hsl(var(--popover))",
            color: "hsl(var(--popover-foreground))",
            fontSize: "13px",
          }}
          formatter={(value: any) => [value, "Bookings"]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Bar
          dataKey="count"
          fill={color}
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
