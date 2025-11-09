"use client";
import React, { useMemo, useCallback } from "react"; // Pastikan useMemo & useCallback di-import
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

// 1. Ganti Props (sesuai kode page.tsx)
type Props = {
  data: ECGDataPoint[];
  title: string;
  yAxisSetting: string; // ('auto', 'half', 'standard', 'double')
  paperSpeedMs: number;
};

// Pola Grid SVG (Tema Hijau)
const ecgGridPattern = (
  <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="smallGrid" width="5" height="5" patternUnits="userSpaceOnUse">
        <path d="M 5 0 L 0 0 0 5" fill="none" stroke="#2a4a3a" strokeWidth="0.5" />
      </pattern>
      <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
        <rect width="25" height="25" fill="url(#smallGrid)" />
        <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#4a7a5a" strokeWidth="0.8" />
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#grid)" />
  </svg>
);

export default function ECGChart({ data, title, yAxisSetting, paperSpeedMs }: Props) {

  // 2. Logic Sensitivitas (Y-Axis)
  const yDomain = useMemo<[number | "auto", number | "auto"]>(() => {
    switch (yAxisSetting) {
      case 'half':     // 5 mm/mV
        return [512 - 700, 512 + 700]; 
      case 'standard': // 10 mm/mV
        return [350, 900]; 
      case 'double':   // 20 mm/mV
        return [512 - 200, 512 + 400]; 
      case 'auto':
      default:
        return ['auto', 'auto'];
    }
  }, [yAxisSetting]);

  // Fungsi format stopwatch (MM:SS)
  const formatXAxisStopwatch = useCallback((millis: number) => {
    if (isNaN(millis) || millis < 0) return "00:00";
    const totalDetik = Math.floor(millis / 1000);
    const menit = Math.floor(totalDetik / 60);
    const detik = totalDetik % 60;
    return `${menit.toString().padStart(2, "0")}:${detik.toString().padStart(2, "0")}`;
  }, []);

  // =============================================================
  // 3. BALIKIN FIX "KEGENCET" (Sliding Window)
  // =============================================================
  const xDomain = useMemo<[number, number] | [string, string]>(() => {
    // Cek dulu datanya ada atau nggak
    if (data.length > 1) {
      // Ambil timestamp TERBARU (paling kanan)
      const lastTimestamp = data[data.length - 1].timestamp;
      // Ambil "lebar panggung" dari prop (misal: 10000ms)
      const windowSizeMs = paperSpeedMs; 
      
      // Hitung batas kiri (paling lama)
      const xMin = lastTimestamp - windowSizeMs;
      // Hitung batas kanan (paling baru)
      const xMax = lastTimestamp;
      
      // Paksa domain chart-nya jadi [kiri, kanan]
      return [xMin < 0 ? 0 : xMin, xMax];
    }
    // Kalau data kosong, biarin otomatis
    return ['auto', 'auto'];
  }, [data, paperSpeedMs]); // Hitung ulang kalau 'data' atau 'paperSpeedMs' berubah
  // =============================================================

  // 4. Render (Tema Hijau)
  return (
    <div className="w-full h-72 bg-gray-900/70 rounded-lg p-3 border border-green-700/30 mb-4 relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-40">{ecgGridPattern}</div>

      <div className="relative z-10 h-full w-full">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-green-400 font-semibold">{title}</h3>
        </div>

        <ResponsiveContainer width="100%" height="85%">
          <LineChart
            data={data}
            margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
          >
            <CartesianGrid
              stroke="#555"
              strokeDasharray="5 5"
              strokeOpacity={0.3}
            />

            {/* ============================================================= */}
            {/* 5. TERAPKAN FIX-NYA DI SINI */}
            {/* ============================================================= */}
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={xDomain} // <-- GANTI: dari ['dataMin', 'dataMax']
              allowDataOverflow={true} // <-- TAMBAHKAN: Biar nggak 'maksa'
              tickFormatter={formatXAxisStopwatch}
              tick={{ fill: "#9ae6b4", fontSize: 11 }}
              axisLine={{ stroke: "#9ae6b4" }}
              tickLine={{ stroke: "#9ae6b4" }}
              height={25}
            />

            <YAxis
              domain={yDomain} // manual domain
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
              labelFormatter={formatXAxisStopwatch}
              isAnimationActive={false}
            />

            <Line
              type="linear" // ngebut
              dataKey="value"
              stroke="#00ff7f" // hijau neon
              strokeWidth={2}
              dot={false}
              isAnimationActive={false} // <-- Kita pakai 'buffering' jadi ini bisa 'false'
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}