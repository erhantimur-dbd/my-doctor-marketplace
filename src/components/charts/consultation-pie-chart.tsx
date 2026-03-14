"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface ConsultationPieChartProps {
  inPersonCount: number;
  videoCount: number;
  height?: number;
}

const COLORS = {
  inPerson: "#3b82f6", // blue
  video: "#22c55e", // green
};

export function ConsultationPieChart({
  inPersonCount,
  videoCount,
  height = 200,
}: ConsultationPieChartProps) {
  const data = [
    { name: "In Person", value: inPersonCount },
    { name: "Video", value: videoCount },
  ].filter((d) => d.value > 0);

  const total = inPersonCount + videoCount;

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
                fill={
                  entry.name === "In Person"
                    ? COLORS.inPerson
                    : COLORS.video
                }
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
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: COLORS.inPerson }}
          />
          <span className="text-sm">
            In Person:{" "}
            <span className="font-medium">
              {inPersonCount} ({Math.round((inPersonCount / total) * 100)}%)
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: COLORS.video }}
          />
          <span className="text-sm">
            Video:{" "}
            <span className="font-medium">
              {videoCount} ({Math.round((videoCount / total) * 100)}%)
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
