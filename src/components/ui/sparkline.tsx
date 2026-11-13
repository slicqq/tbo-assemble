"use client";

import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

// Tremor-style sparkline: a tiny, axis-less area chart for KPI cards
export function Sparkline({ data, color = "var(--brand)", className = "h-10 w-full" }: { data: number[]; color?: string; className?: string }) {
  const id = useId().replace(/:/g, "");
  const points = data.map((v, i) => ({ i, v }));
  if (points.length < 2) return <div className={className} />;
  return (
    <div className={className} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#spark-${id})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
