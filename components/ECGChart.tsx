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

// =============================================================
// Pola Grid SVG (Ini udah keren, nggak saya ubah)
// =============================================================
// =============================================================
// Pola Grid SVG (SETELAH PERBAIKAN)
// =============================================================
const ecgGridPattern = (
  <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      {/* Pola Garis Kecil (misal: setiap 5 pixel) */}
      <pattern id="smallGrid" width="5" height="5" patternUnits="userSpaceOnUse">
        {/* PERUBAHAN DI SINI: Stroke lebih terang, strokeWidth lebih tebal */}
        <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#3d6d52" strokeWidth="0.7"/> 
      </pattern>
      {/* Pola Garis Besar (tetap sama, atau bisa disesuaikan juga) */}
      <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
        <rect width="25" height="25" fill="url(#smallGrid)"/>
        <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#6aa17a" strokeWidth="1.2"/> 
      </pattern>
    </defs>
    {/* Terapkan pola garis besar ke seluruh area SVG */}
    <rect width="100%" height="100%" fill="url(#grid)" />
  </svg>
);
// =============================================================


export default function ECGChart({ data, title, yAxisMode }: Props) {

  // Tentukan domain Sumbu Y (Fixed atau Auto)
  const yDomain: [number | 'auto', number | 'auto'] = yAxisMode === 'fixed' 
    ? [350, 900] 
    : ['auto', 'auto'];

  // Fungsi untuk format timestamp jadi jam (HH:mm:ss)
  const formatXAxis = (timestamp: number) => {
    const date = new Date(timestamp);
    const jam = date.getHours().toString().padStart(2, '0');
    const menit = date.getMinutes().toString().padStart(2, '0');
    const detik = date.getSeconds().toString().padStart(2, '0');
    return `${jam}:${menit}:${detik}`;
  };

  return (
    // Layering background dan chart (Ini udah bener)
    <div 
      className="w-full h-72 bg-black/60 rounded-lg p-3 border border-green-700/30 mb-4 relative overflow-hidden" 
    >
      {/* Background SVG Grid Pattern */}
      <div className="absolute inset-0 z-0 opacity-40"> 
        {ecgGridPattern}
      </div>
      
      {/* Konten Chart (di atas background) */}
      <div className="relative z-10 h-full w-full"> 
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-green-400 font-semibold">{title}</h3>
        </div>

        <ResponsiveContainer width="100%" height="85%">
          <LineChart data={data}> {/* <-- GANTI: Langsung pakai 'data' */}
            
            <CartesianGrid stroke="#555" strokeDasharray="5 5" strokeOpacity={0.3} /> 
            
            {/* ================= PERBAIKAN DI SINI ================= */}
            <XAxis 
              dataKey="timestamp" // <-- GANTI: Pakai 'timestamp'
              type="number"       // <-- Tipe data-nya 'number'
              domain={['dataMin', 'dataMax']} // <-- Domain otomatis
              tickFormatter={formatXAxis}     // <-- Format jadi jam
              tick={{ fill: "#9ae6b4", fontSize: 11 }}
              axisLine={{ stroke: "#9ae6b4" }}
              tickLine={{ stroke: "#9ae6b4" }}
              height={25}
            /> 
            {/* ================= AKHIR PERBAIKAN ================= */}

            <YAxis
              domain={yDomain} 
              tick={{ fill: "#9ae6b4", fontSize: 11 }}
              width={40}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ background: "#0b1220", border: "1px solid #163a17" }}
              itemStyle={{ color: "#9ae6b4" }}
              labelStyle={{ color: "#fff" }}
              formatter={(value: number) => [value, "ADC"]}
              labelFormatter={formatXAxis} // <-- Format jam di tooltip juga
            />
            <Line
              isAnimationActive={false} 
              dot={false}
              dataKey="value" // <-- Data Y tetap 'value'
              stroke="#00ff7f" // Warna hijau neon
              strokeWidth={1.6}
              type="monotone"
            />
          </LineChart>
        </ResponsiveContainer>
      </div> 
    </div>
  );
}