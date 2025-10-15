"use client";
import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type ECGData = {
  time: number;
  value: number;
};

type Props = {
  data: ECGData[];
};

export default function ECGChart({ data }: Props) {
  // ✅ perbaikan di sini
  const chartData = data.map((v, i) => ({ i, value: v.value }));

  return (
    <div className="w-full h-72 md:h-96 bg-black/60 rounded-lg p-3 border border-green-700/30">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-green-400 font-semibold">ECG Real-time Signal</h3>
        <span className="text-sm text-gray-400">Live</span>
      </div>

      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={chartData}>
          <CartesianGrid stroke="#143214" strokeDasharray="3 3" />
          <XAxis dataKey="i" hide />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "#9ae6b4", fontSize: 11 }}
            width={40}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ background: "#0b1220", border: "1px solid #163a17" }}
            itemStyle={{ color: "#9ae6b4" }}
            labelStyle={{ color: "#fff" }}
            formatter={(value: any) => [value, "ADC"]}
          />
          <Line
            isAnimationActive={false}
            dot={false}
            dataKey="value"
            stroke="#00ff7f"
            strokeWidth={1.6}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
