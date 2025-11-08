"use client";
import React, { useMemo, useCallback } from "react";
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
  timestamp: number; // Ini 'millis()' (durasi), e.g., 90000
  value: number;
};

type Props = {
  data: ECGDataPoint[];
  title: string;
  yAxisMode: 'auto' | 'fixed'; 
};

// Pola Grid SVG (Tema Hijau - Sesuai request-mu)
const ecgGridPattern = (
  <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="smallGrid" width="5" height="5" patternUnits="userSpaceOnUse">
        <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#2a4a3a" strokeWidth="0.5"/> 
      </pattern>
      <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
        <rect width="25" height="25" fill="url(#smallGrid)"/>
        <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#4a7a5a" strokeWidth="0.8"/> 
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />
  </svg>
);


export default function ECGChart({ data, title, yAxisMode }: Props) {

  const yDomain: [number | 'auto', number | 'auto'] = yAxisMode === 'fixed' 
    ? [350, 900] 
    : ['auto', 'auto'];

  // =============================================================
  // FIX 1: Ganti format jam (07:00) jadi stopwatch (MM:SS)
  // =============================================================
  const formatXAxisStopwatch = useCallback((millis: number) => {
    if (isNaN(millis) || millis < 0) return "00:00";
    const totalDetik = Math.floor(millis / 1000);
    const menit = Math.floor(totalDetik / 60);
    const detik = totalDetik % 60;
    return `${menit.toString().padStart(2, "0")}:${detik.toString().padStart(2, "0")}`;
  }, []);

  // =============================================================
  // FIX 2: Hitung domain manual biar gak "kegencet"
  // =============================================================
  const xDomain = useMemo<[number, number] | [string, string]>(() => {
    if (data.length > 1) {
      // Ambil timestamp data PERTAMA (paling lama)
      const xMin = data[0].timestamp; 
      // Ambil timestamp data TERAKHIR (paling baru)
      const xMax = data[data.length - 1].timestamp; 
      // Paksa domain chart-nya selebar data
      return [xMin, xMax];
    }
    return ['auto', 'auto']; // Fallback kalau data kosong
  }, [data]);


  return (
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
          <LineChart data={data}>
            
            <CartesianGrid stroke="#555" strokeDasharray="5 5" strokeOpacity={0.3} /> 
            
            {/* ============================================================= */}
            {/* TERAPKAN SEMUA FIX DI SINI */}
            {/* ============================================================= */}
            <XAxis 
              dataKey="timestamp"
              type="number"
              domain={xDomain} // <-- FIX 2 (Anti-kegencet)
              allowDataOverflow={true} // <-- FIX 2 (Anti-kegencet)
              tickFormatter={formatXAxisStopwatch} // <-- FIX 1 (Stopwatch)
              tick={{ fill: "#9ae6b4", fontSize: 11 }}
              axisLine={{ stroke: "#9ae6b4" }}
              tickLine={{ stroke: "#9ae6b4" }}
              height={25}
            /> 

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
              labelFormatter={formatXAxisStopwatch} // <-- FIX 1 (Stopwatch)
            />
            <Line
              isAnimationActive={false} 
              dot={false}
              dataKey="value"
              stroke="#00ff7f" // Warna hijau neon
              strokeWidth={1.6}
              type="linear" // <-- FIX 3 (Anti-patah-patah)
            />
          </LineChart>
        </ResponsiveContainer>
      </div> 
    </div>
  );
}