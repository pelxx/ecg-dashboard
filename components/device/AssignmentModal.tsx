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
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--foreground)] shadow-2xl">
      <h3 className="mb-4 text-lg font-semibold text-[var(--foreground)]">
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
                type="button"
                onClick={() => setGender(value)}
                className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                  gender === value
                    ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                    : "border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] hover:opacity-80"
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
              type="button"
              onClick={handleRemove}
              disabled={saving}
              className="rounded-md bg-[var(--danger)] px-4 py-2 text-white transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-2 text-sm text-[var(--foreground)] transition-colors hover:opacity-80"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-85 disabled:opacity-50"
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
    <label className="block text-sm text-[var(--foreground)]">
      <span className="mb-1 block text-[var(--text-secondary)]">
        {label}
      </span>
      {children}
    </label>
  );
}

