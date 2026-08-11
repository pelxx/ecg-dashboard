"use client";

import { useEffect, useState } from "react";
import { removeDeviceAssignment, saveDeviceAssignment } from "@/services/device.service";
import type { DeviceCard } from "@/types/device";
import type { PatientProfile } from "@/types/patient";

type Props = {
  readonly open: boolean;
  readonly device?: DeviceCard | null;
  readonly onClose: () => void;
};

export default function AssignmentModal({ open, device, onClose }: Props) {
  const [deviceId, setDeviceId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [gender, setGender] = useState("Laki-laki");
  const [doctor, setDoctor] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    const assignment = device?.assignment;
    setDeviceId(device?.deviceId ?? "");
    setPatientId(assignment?.patientId ?? "");
    setPatientName(assignment?.patientName ?? "");
    setAge(assignment?.age || "");
    setGender(assignment?.gender || "Laki-laki");
    setDoctor(assignment?.doctor ?? "");
  }, [device, open]);

  if (!open) return null;

  const handleSave = async () => {
    const normalizedDeviceId = deviceId.trim();
    if (!normalizedDeviceId || !patientName.trim() || age === "") {
      alert("Isi Device ID, nama pasien, dan umur.");
      return;
    }

    const assignment: PatientProfile = {
      patientId: patientId.trim() || normalizedDeviceId,
      patientName: patientName.trim(),
      age: Number(age),
      gender,
      doctor: doctor.trim() || undefined,
      admissionDate: device?.assignment.admissionDate ?? Date.now(),
    };

    setSaving(true);
    try {
      await saveDeviceAssignment(normalizedDeviceId, assignment);
      onClose();
    } catch (error) {
      console.error("Failed to save assignment:", error);
      alert("Gagal menyimpan assignment.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!device?.deviceId) return;
    if (!confirm("Hapus assignment dari device ini?")) return;

    setSaving(true);
    try {
      await removeDeviceAssignment(device.deviceId);
      onClose();
    } catch (error) {
      console.error("Failed to remove assignment:", error);
      alert("Gagal menghapus assignment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-emerald-800/40 bg-slate-950 p-5 shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold text-emerald-200">
          {device ? "Edit Assignment" : "Create Assignment"}
        </h3>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field label="Device ID">
            <input
              value={deviceId}
              disabled={Boolean(device)}
              onChange={(event) => setDeviceId(event.target.value)}
              className="field-input disabled:opacity-60"
              placeholder="device001"
            />
          </Field>

          <Field label="Patient ID">
            <input
              value={patientId}
              onChange={(event) => setPatientId(event.target.value)}
              className="field-input"
              placeholder="P-001"
            />
          </Field>

          <Field label="Nama">
            <input
              value={patientName}
              onChange={(event) => setPatientName(event.target.value)}
              className="field-input"
              placeholder="Nama pasien"
            />
          </Field>

          <Field label="Umur">
            <input
              type="number"
              value={age}
              onChange={(event) =>
                setAge(event.target.value === "" ? "" : Number(event.target.value))
              }
              className="field-input"
              placeholder="Umur"
            />
          </Field>

          <Field label="Jenis Kelamin">
            <div className="flex gap-2">
              {["Laki-laki", "Perempuan"].map((value) => (
                <button
                  key={value}
                  onClick={() => setGender(value)}
                  className={`rounded px-3 py-2 text-sm ${
                    gender === value
                      ? "bg-emerald-500 text-slate-950"
                      : "border border-emerald-800/30 bg-slate-900 text-slate-200"
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </Field>
          
          <Field label="Doctor">
            <input
              value={doctor}
              onChange={(event) => setDoctor(event.target.value)}
              className="field-input"
              placeholder="Dokter"
            />
          </Field>
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
              className="rounded border border-slate-700 bg-slate-900 px-4 py-2 text-slate-200"
            >
              Batal
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-emerald-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <label className="block text-sm text-slate-300">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}
