"use client";
import React from "react";


type Props = {
  id: string;
  name: string;
  age: number;
  gender: string;
  bpm: number; 
};

export default function PatientInfo({ id, name, age, gender, bpm }: Props) {
  // Fungsi untuk menentukan warna BPM berdasarkan nilainya
  const getBpmColor = () => {
    if (!bpm || bpm < 50 || bpm > 120) return "text-red-400";
    if (bpm < 60 || bpm > 100) return "text-yellow-400";
    return "text-green-400";
  };

  return (
    <div className="bg-gray-900/70 border border-green-800/30 rounded-lg p-4 w-full">
      <h4 className="text-green-400 font-semibold mb-3">Patient Information</h4>
      <div className="text-sm text-gray-300 space-y-1">
        <p><span className="text-gray-400 w-24 inline-block">ID:</span> <span className="text-white font-mono text-xs">{id}</span></p>
        <p><span className="text-gray-400 w-24 inline-block">Nama:</span> <span className="text-white">{name}</span></p>
        <p><span className="text-gray-400 w-24 inline-block">Umur:</span> <span className="text-white">{age} tahun</span></p>
        <p><span className="text-gray-400 w-24 inline-block">Jenis Kelamin:</span> <span className="text-white">{gender}</span></p>
      </div>

      {/* --- BAGIAN TAMPILAN BPM --- */}
      <div className="mt-4 pt-4 border-t border-green-800/30">
        <p className="text-gray-400 text-sm">Heart Rate</p>
        <p className={`text-4xl font-bold ${getBpmColor()}`}>
          {/* Tampilkan '--' jika BPM 0 atau tidak valid */}
          {bpm > 0 ? bpm : "--"} 
          <span className="text-lg font-normal ml-2">BPM</span>
        </p>
      </div>
    </div>
  );
}