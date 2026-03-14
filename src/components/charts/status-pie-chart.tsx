"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface StatusPieChartProps {
  completedCount: number;
  confirmedCount: number;
  cancelledCount: number;
  noShowCount: number;
  height?: number;
}

const STATUS_COLORS: Record<string, string> = {
  Completed: "#22c55e",
  Upcoming: "#3b82f6",
  Cancelled: "#ef4444",
  "No Show": "#eab308",
};

export function StatusPieChart({
  completedCount,
  confirmedCount,
  cancelledCount,
  noShowCount,
  height = 200,
}: StatusPieChartProps) {
  const data = [
    { name: "Completed", value: completedCount },
    { name: "Upcoming", value: confirmedCount },
    { name: "Cancelled", value: cancelledCount },
    { name: "No Show", value: noShowCount },
  ].filter((d) => d.value > 0);

  const total = completedCount + confirmedCount + cancelledCount + noShowCount;

  if (total === 0) return null;

  return (
    <div className="flex items-center gap-6">
      <ResponsiveContainer width={height} height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={2}
            stroke="hsl(var(--background))"
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={STATUS_COLORS[entry.name] || "#94a3b8"}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid hsl(var(--border))",
              background: "hsl(var(--popover))",
              color: "hsl(var(--popover-foreground))",
              fontSize: "13px",
            }}
            formatter={(value: any, name: any) => [
              `${value} (${Math.round((Number(value) / total) * 100)}%)`,
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-2">
        {data.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: STATUS_COLORS[entry.name] }}
            />
            <span className="text-sm">
              {entry.name}:{" "}
              <span className="font-medium">
                {entry.value} ({Math.round((entry.value / total) * 100)}%)
              </span>
            </span>
          </div>
        ))}
        <div className="border-t pt-2 text-sm font-medium">
          Total: {total}
        </div>
      </div>
    </div>
  );
}
