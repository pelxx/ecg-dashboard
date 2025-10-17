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

type ECGDataPoint = {
  timestamp: number;
  value: number;
};

type Props = {
  data: ECGDataPoint[];
  title: string;
  yAxisMode: 'auto' | 'fixed'; 
};

export default function ECGChart({ data, title, yAxisMode }: Props) {
  const chartData = data.map((point, index) => ({
    index: index,
    value: point.value,
  }));

  const yDomain: [number | 'auto', number | 'auto'] = yAxisMode === 'fixed' 
    ? [350, 900] 
    : ['auto', 'auto'];

  return (
    <div className="w-full h-72 bg-black/60 rounded-lg p-3 border border-green-700/30 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-green-400 font-semibold">{title}</h3>
      </div>

      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={chartData}>
          <CartesianGrid stroke="#143214" strokeDasharray="3 3" />
          <XAxis dataKey="index" hide />
          <YAxis
            domain={yDomain}
            tick={{ fill: "#9ae6b4", fontSize: 11 }}
            width={40}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ background: "#0b1220", border: "1px solid #163a17" }}
            itemStyle={{ color: "#9ae6b4" }}
            labelStyle={{ color: "#fff" }}
            formatter={(value: number) => [value, "ADC"]}
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