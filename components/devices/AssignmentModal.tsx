"use client";

import { useEffect, useState } from "react";
import { ref, remove, update } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import type { DeviceCard } from "@/hooks/useDevices";

type Props = {
  open: boolean;
  device?: DeviceCard | null;
  onClose: () => void;
};

export default function AssignmentModal({ open, device, onClose }: Props) {
  const [deviceId, setDeviceId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState("Laki-laki");
  const [doctor, setDoctor] = useState("");
  const [medicalRecord, setMedicalRecord] = useState("");
  const [room, setRoom] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    setDeviceId(device?.deviceId ?? "");
    setPatientName(device?.assignment.patientName ?? "");
    setAge(device?.assignment.age || "");
    setGender(device?.assignment.gender || "Laki-laki");
    setDoctor(device?.assignment.doctor ?? "");
    setMedicalRecord(device?.assignment.medicalRecord ?? "");
    setRoom(device?.assignment.room ?? "");
  }, [device, open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!deviceId.trim() || !patientName.trim() || age === "") {
      alert("Isi Device ID, nama pasien, dan umur");
      return;
    }

    setSaving(true);
    try {
      await update(ref(rtdb, `devices/${deviceId.trim()}`), {
        assignment: {
          patientName: patientName.trim(),
          age: Number(age),
          gender,
          doctor: doctor.trim(),
          medicalRecord: medicalRecord.trim(),
          room: room.trim(),
        },
        updatedAt: Date.now(),
      });
      onClose();
    } catch (error) {
      console.error("Gagal menyimpan assignment:", error);
      alert("Gagal menyimpan assignment");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!device?.deviceId) return;
    if (!confirm("Hapus assignment dari device ini?")) return;

    setSaving(true);
    try {
      await remove(ref(rtdb, `devices/${device.deviceId}/assignment`));
      await update(ref(rtdb, `devices/${device.deviceId}`), {
        updatedAt: Date.now(),
      });
      onClose();
    } catch (error) {
      console.error("Gagal menghapus assignment:", error);
      alert("Gagal menghapus assignment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg border border-blue-900/40 bg-gray-900 p-5 shadow-xl">
        <h3 className="mb-3 text-lg font-semibold text-blue-200">
          {device ? "Edit Assignment" : "Create Assignment"}
        </h3>

        <label className="mb-1 block text-sm text-gray-300">Device ID</label>
        <input
          value={deviceId}
          disabled={!!device}
          onChange={(event) => setDeviceId(event.target.value)}
          className="mb-3 w-full rounded border border-blue-800/40 bg-gray-800 p-2 text-white disabled:opacity-60"
          placeholder="device001"
        />

        <label className="mb-1 block text-sm text-gray-300">Nama</label>
        <input
          value={patientName}
          onChange={(event) => setPatientName(event.target.value)}
          className="mb-3 w-full rounded border border-blue-800/40 bg-gray-800 p-2 text-white"
          placeholder="Nama pasien"
        />

        <label className="mb-1 block text-sm text-gray-300">Umur</label>
        <input
          type="number"
          value={age}
          onChange={(event) =>
            setAge(event.target.value === "" ? "" : Number(event.target.value))
          }
          className="mb-3 w-full rounded border border-blue-800/40 bg-gray-800 p-2 text-white"
          placeholder="Umur"
        />

        <label className="mb-2 block text-sm text-gray-300">
          Jenis Kelamin
        </label>
        <div className="mb-4 flex gap-2">
          {["Laki-laki", "Perempuan"].map((value) => (
            <button
              key={value}
              onClick={() => setGender(value)}
              className={`rounded px-3 py-1 ${
                gender === value
                  ? "bg-blue-500 text-black"
                  : "border border-blue-800/30 bg-gray-800 text-white"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input
            value={doctor}
            onChange={(event) => setDoctor(event.target.value)}
            className="rounded border border-blue-800/40 bg-gray-800 p-2 text-white"
            placeholder="Dokter"
          />
          <input
            value={medicalRecord}
            onChange={(event) => setMedicalRecord(event.target.value)}
            className="rounded border border-blue-800/40 bg-gray-800 p-2 text-white"
            placeholder="No. RM"
          />
          <input
            value={room}
            onChange={(event) => setRoom(event.target.value)}
            className="rounded border border-blue-800/40 bg-gray-800 p-2 text-white md:col-span-2"
            placeholder="Ruangan"
          />
        </div>

        <div className="mt-5 flex justify-between gap-2">
          <div>
            {device && (
              <button
                onClick={handleRemove}
                disabled={saving}
                className="rounded bg-red-600 px-4 py-2 text-white disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded border border-blue-800/30 bg-gray-800 px-4 py-2 text-gray-200"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-blue-500 px-4 py-2 font-semibold text-black disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
