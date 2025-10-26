"use client";
import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid, // Kita akan tetap gunakan ini untuk grid utama
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

// ================= PERUBAHAN DI SINI (1) =================
// Definisikan pola grid SVG
const ecgGridPattern = (
  <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      {/* Pola Garis Kecil (misal: setiap 5 pixel) */}
      <pattern id="smallGrid" width="5" height="5" patternUnits="userSpaceOnUse">
        <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#2a4a3a" strokeWidth="0.5"/> 
      </pattern>
      {/* Pola Garis Besar (misal: setiap 25 pixel - 5x garis kecil) */}
      <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
        <rect width="25" height="25" fill="url(#smallGrid)"/>
        <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#4a7a5a" strokeWidth="1"/> 
      </pattern>
    </defs>
    {/* Terapkan pola garis besar ke seluruh area SVG */}
    <rect width="100%" height="100%" fill="url(#grid)" />
  </svg>
);
// ================= AKHIR PERUBAHAN (1) =================


export default function ECGChart({ data, title, yAxisMode }: Props) {
  const chartData = data.map((point, index) => ({
    index: index,
    value: point.value,
  }));

  const yDomain: [number | 'auto', number | 'auto'] = yAxisMode === 'fixed' 
    ? [350, 900] 
    : ['auto', 'auto'];

  return (
    // ================= PERUBAHAN DI SINI (2) =================
    // Tambahkan style untuk background dan atur posisi relatif
    <div 
      className="w-full h-72 bg-black/60 rounded-lg p-3 border border-green-700/30 mb-4 relative overflow-hidden" 
    >
      {/* Tampilkan pola SVG di background, di belakang chart */}
      <div className="absolute inset-0 z-0 opacity-40"> 
        {ecgGridPattern}
      </div>
      {/* Konten chart ditaruh di atas background */}
      <div className="relative z-10 h-full w-full"> 
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-green-400 font-semibold">{title}</h3>
        </div>

        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={chartData}>
            {/* Buat grid Recharts lebih transparan atau tipis 
              agar tidak terlalu mendominasi background SVG 
            */}
            <CartesianGrid stroke="#555" strokeDasharray="5 5" strokeOpacity={0.3} /> 
            
            <XAxis dataKey="index" hide /> 
            <YAxis
              domain={yDomain} 
              tick={{ fill: "#9ae6b4", fontSize: 11 }}
              width={40}
              axisLine={false}
              tickLine={false} // Sembunyikan garis tick agar tidak bentrok dengan grid
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
    </div>
    // ================= AKHIR PERUBAHAN (2) =================
  );
}