"use client";
import React from "react";

type Props = {
  currentSpeed: number;
  onSpeedChange: (speedMs: number) => void;
  currentSensitivity: string;
  onSensitivityChange: (sensitivity: string) => void;
};

export default function ChartSettings({
  currentSpeed,
  onSpeedChange,
  currentSensitivity,
  onSensitivityChange,
}: Props) {
  
  const speedButtons = [
    { label: "25 mm/s", value: 10000 }, // 10 detik
    { label: "50 mm/s", value: 5000 },  // 5 detik
    { label: "100 mm/s", value: 2500 }, // 2.5 detik
  ];

  const sensitivityButtons = [
    { label: "Auto", value: "auto" },
    { label: "5 mm/mV", value: "half" },
    { label: "10 mm/mV", value: "standard" },
    { label: "20 mm/mV", value: "double" },
  ];

  return (
    // Tema BIRU (ngikutin Patient Info)
    <div className="bg-gray-900/70 border border-green-800/30 p-4 rounded-lg ">
      <h2 className="text-l font-semibold text-green-400 mb-4">
        Pengaturan Chart
      </h2>
      
      {/* Bagian Sensitivitas */}
      <div className="space-y-2">
        <span className="text-sm text-gray-400">Sensitivitas (Gain):</span>
        <div className="flex flex-wrap gap-2">
          {sensitivityButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => onSensitivityChange(btn.value)}
              className={`px-3 py-1 text-xs rounded ${
                currentSensitivity === btn.value
                  ? "bg-green-500 text-white" // Tombol aktif: HIJAU
                  : "bg-gray-700 text-gray-300"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Bagian Laju Kertas */}
      <div className="mt-4 space-y-2">
        <span className="text-sm text-gray-400">Laju Kertas (Speed):</span>
        <div className="flex flex-wrap gap-2">
          {speedButtons.map((btn) => (
            <button
              key={btn.value}
              onClick={() => onSpeedChange(btn.value)}
              className={`px-3 py-1 text-xs rounded ${
                currentSpeed === btn.value
                  ? "bg-green-500 text-white" // Tombol aktif: HIJAU
                  : "bg-gray-700 text-gray-300"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}