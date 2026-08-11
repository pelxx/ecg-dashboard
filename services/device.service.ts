
import { off, onValue, ref, remove, update } from "firebase/database";
import { rtdb } from "@/lib/firebase";
import type { DeviceCard, RawDevice } from "@/types/device";
import type { PatientProfile } from "@/types/patient";
import { toFiniteNumber } from "@/utils/ecg";

const toNumber = (value: unknown): number => toFiniteNumber(value) ?? 0;

export const normalizeDevice = (
  deviceId: string,
  raw: RawDevice = {}
): DeviceCard => {
  const assignment = raw.assignment ?? {};
  const patientName =
    assignment.patientName ?? raw.patientName ?? raw.nama ?? "Belum ditugaskan";
  const age = toNumber(assignment.age ?? raw.age ?? raw.umur);
  const gender = assignment.gender ?? raw.gender ?? raw.jenis_kelamin ?? "-";
 

  const patient: PatientProfile = {
    patientId:
      assignment.patientId ?? raw.patientId ?? assignment.medicalRecord ?? deviceId,
    patientName,
    age,
    gender,
    doctor: assignment.doctor ?? raw.doctor,
    admissionDate: assignment.admissionDate ?? raw.admissionDate,
  };

  return {
    key: deviceId,
    deviceId,
    assignment: patient,
    nama: patientName,
    umur: age,
    jenis_kelamin: gender,
    status: raw.status,
    lastSeen: raw.lastSeen,
    isRecording: raw.isRecording,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    telemetry: {
      ...raw.telemetry,
      lastSeen: raw.lastSeen ?? raw.telemetry?.lastSeen,
      mqttConnected: raw.status === "mqtt_connected",
      sampleRateHz: toFiniteNumber(raw.sampleRateHz) ?? raw.telemetry?.sampleRateHz,
      uptimeSeconds:
        toFiniteNumber(raw.uptimeSeconds) ?? raw.telemetry?.uptimeSeconds,
      streaming:
        typeof raw.streaming === "boolean" ? raw.streaming : raw.telemetry?.streaming,
    },
  };
};

export const subscribeDevices = (
  onDevices: (devices: readonly DeviceCard[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  const node = ref(rtdb, "devices");
  const unsubscribe = onValue(
    node,
    (snapshot) => {
      const value = (snapshot.val() || {}) as Record<string, RawDevice>;
      const devices = Object.entries(value)
        .map(([deviceId, raw]) => normalizeDevice(deviceId, raw ?? {}))
        .sort(
          (a, b) =>
            (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
        );

      onDevices(devices);
    },
    (error) => onError?.(error)
  );

  return () => off(node, "value", unsubscribe);
};

export const saveDeviceAssignment = async (
  deviceId: string,
  assignment: PatientProfile
): Promise<void> => {
  await update(ref(rtdb, `devices/${deviceId}`), {
    assignment,
    updatedAt: Date.now(),
  });
};

export const removeDeviceAssignment = async (deviceId: string): Promise<void> => {
  await remove(ref(rtdb, `devices/${deviceId}/assignment`));
  await update(ref(rtdb, `devices/${deviceId}`), {
    updatedAt: Date.now(),
  });
};
