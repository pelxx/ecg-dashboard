"use client";

import { useAuth } from "@/hooks/useAuth";
import { usePatients } from "@/hooks/usePatients";
import { useMQTT } from "@/hooks/useMQTT";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";

import PatientInfo from "@/components/dashboard/PatientInfo";
import DeviceStatus from "@/components/dashboard/DeviceStatus";
import ControlPanel from "@/components/dashboard/ControlPanel";
import ChartSettings from "@/components/ecgGraph/ChartSettings";
import DataLogger from "@/components/dashboard/DataLogger";
import ECGCanvasSweep from "@/components/ecgGraph/ECGCanvas";

function PatientsContent() {
  const router = useRouter();

  const { user, loading: authLoading } = useAuth();
  const { patients, loading } = usePatients();

  const params = useSearchParams();
  const selectedKey = params.get("key");

  const [paperSpeed, setPaperSpeed] = useState(5000);
  const [sensitivity, setSensitivity] = useState<
    "auto" | "half" | "standard" | "double"
  >("standard");
  const [recordingStatus, setRecordingStatus] = useState<any>({});

  const handleRecordToggle = (deviceId: string, status: boolean) => {
  setRecordingStatus((prev: any) => ({
    ...prev,
    [deviceId]: status
  }));
};

const handleManualSave = (deviceId: string) => {
  alert("Manual save (bisa kamu sambungkan ke Firebase nanti)");
};

  const {
    liveEcgData,
    liveBPM,
    lastDeviceActivity
  } = useMQTT({
    patients,
    selectedKey,
    paperSpeed,
    recordingStatus
  });

  // =====================
  // LOADING
  // =====================
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-black">
        Loading...
      </div>
    );
  }

  // =====================
  // MODE 1: LIST PASIEN
  // =====================
  if (!selectedKey) {
    return (
      <main className="min-h-screen bg-black text-white p-6">
        <h1 className="text-3xl font-bold text-blue-400 mb-6">
          Daftar Pasien
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((p: any) => (
            <div
              key={p.key}
              onClick={() => router.push(`/patients?key=${p.key}`)}
              className="bg-gray-900 p-4 rounded-lg border border-gray-800 cursor-pointer hover:border-blue-500 transition"
            >
              <h2 className="text-lg font-semibold">{p.nama}</h2>
              <p className="text-sm text-gray-400">
                {p.jenis_kelamin} - {p.umur} tahun
              </p>
            </div>
          ))}
        </div>
      </main>
    );
  }

  // =====================
  // MODE 2: DETAIL ECG
  // =====================
  const patient = patients.find((p: any) => p.key === selectedKey);
  const leads = liveEcgData[selectedKey];

  if (!patient) {
    return <div className="text-white p-6">Pasien tidak ditemukan</div>;
  }

 return (
  <main className="min-h-screen bg-black text-white p-6">
    {/* HEADER */}
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-2xl font-bold text-blue-400">
        {patient.nama}
      </h1>

      <button
        onClick={() => router.push("/patients")}
        className="bg-gray-800 px-3 py-1 rounded hover:bg-gray-700"
      >
        ← Kembali
      </button>
    </div>

    <div className="flex flex-col lg:flex-row gap-6">

      {/* ================= LEFT PANEL ================= */}
      <div className="w-full lg:w-1/3 flex flex-col gap-4">

        <PatientInfo
          id={patient.key}
          name={patient.nama}
          age={patient.umur}
          gender={patient.jenis_kelamin}
          bpm={liveBPM[selectedKey] || 0}
        />

        <ChartSettings
          currentSpeed={paperSpeed}
          onSpeedChange={setPaperSpeed}
          currentSensitivity={sensitivity}
          onSensitivityChange={(value) =>
            setSensitivity(value as "auto" | "half" | "standard" | "double")
          }
        />

        <DeviceStatus
          deviceId={selectedKey}
          lastActivityTimestamp={lastDeviceActivity[selectedKey] || null}
        />

        <ControlPanel
          deviceId={selectedKey}
          onRecordToggle={handleRecordToggle}
          onManualSave={handleManualSave}
        />

      </div>

      {/* ================= RIGHT PANEL ================= */}
      <div className="w-full lg:w-2/3 flex flex-col gap-4">

        <div className="bg-gray-900 p-4 rounded border border-green-700/30">
          <h2 className="text-green-400 font-semibold mb-2">
            ECG Realtime
          </h2>

          <ECGCanvasSweep title="Lead I" data={leads?.lead1 || []} windowMs={paperSpeed} sensitivity={sensitivity} />
          <ECGCanvasSweep title="Lead II" data={leads?.lead2 || []} windowMs={paperSpeed} sensitivity={sensitivity} />
          <ECGCanvasSweep title="Lead III" data={leads?.lead3 || []} windowMs={paperSpeed} sensitivity={sensitivity} />
        </div>

        <DataLogger patientId={selectedKey} />

      </div>
    </div>
  </main>
);
}

export default function PatientsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-white bg-black">
          Loading...
        </div>
      }
    >
      <PatientsContent />
    </Suspense>
  );
}
