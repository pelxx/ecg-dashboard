"use client";
import React from "react";

type Props = {
  id: string;
  name: string;
  age: number;
  gender: string;
};

export default function PatientInfo({ id, name, age, gender }: Props) {
  return (
    <div className="bg-gray-900/70 border border-green-800/30 rounded-lg p-4 w-full md:w-80">
      <h4 className="text-green-300 font-semibold mb-2">Patient Information</h4>
      <div className="text-sm text-gray-300">
        <p><span className="text-gray-400">ID:</span> <span className="text-white">{id}</span></p>
        <p><span className="text-gray-400">Nama:</span> <span className="text-white">{name}</span></p>
        <p><span className="text-gray-400">Umur:</span> <span className="text-white">{age} tahun</span></p>
        <p><span className="text-gray-400">Jenis Kelamin:</span> <span className="text-white">{gender}</span></p>
      </div>
    </div>
  );
}
