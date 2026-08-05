"use client";

import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { rtdb } from "@/lib/firebase";

export type DeviceAssignment = {
  patientName: string;
  age: number;
  gender: string;
  doctor?: string;
  medicalRecord?: string;
  room?: string;
};

export type DeviceCard = {
  key: string;
  deviceId: string;
  assignment: DeviceAssignment;
  nama: string;
  umur: number;
  jenis_kelamin: string;
  status?: string;
  lastSeen?: number;
  isRecording?: boolean;
  createdAt?: number;
  updatedAt?: number;
};

type RawDevice = {
  assignment?: Partial<DeviceAssignment>;
  patientName?: string;
  age?: number | string;
  gender?: string;
  nama?: string;
  umur?: number | string;
  jenis_kelamin?: string;
  status?: string;
  lastSeen?: number;
  isRecording?: boolean;
  createdAt?: number;
  updatedAt?: number;
};

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const normalizeDevice = (deviceId: string, raw: RawDevice): DeviceCard => {
  const assignment = raw.assignment ?? {};
  const patientName =
    assignment.patientName ?? raw.patientName ?? raw.nama ?? "Belum ditugaskan";
  const age = toNumber(assignment.age ?? raw.age ?? raw.umur);
  const gender =
    assignment.gender ?? raw.gender ?? raw.jenis_kelamin ?? "-";

  return {
    key: deviceId,
    deviceId,
    assignment: {
      patientName,
      age,
      gender,
      doctor: assignment.doctor,
      medicalRecord: assignment.medicalRecord,
      room: assignment.room,
    },
    nama: patientName,
    umur: age,
    jenis_kelamin: gender,
    status: raw.status,
    lastSeen: raw.lastSeen,
    isRecording: raw.isRecording,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
};

export const useDevices = () => {
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<DeviceCard[]>([]);

  useEffect(() => {
    const node = ref(rtdb, "devices");

    const unsub = onValue(node, (snap) => {
      const val = (snap.val() || {}) as Record<string, RawDevice>;
      const arr = Object.entries(val).map(([deviceId, value]) =>
        normalizeDevice(deviceId, value ?? {})
      );

      arr.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
      setDevices(arr);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { devices, loading };
};
