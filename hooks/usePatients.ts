"use client";
import { useEffect, useState } from "react";
import { ref, onValue } from "firebase/database";
import { rtdb } from "@/lib/firebase";
type Patient = {
  key: string;
  nama: string;
  umur: number;
  jenis_kelamin: string;
  createdAt?: number;
};

export const usePatients = () => {
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<Patient[]>([]);
  useEffect(() => {
    const node = ref(rtdb, "patients");

    const unsub = onValue(node, (snap) => {
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([k, v]: any) => ({
        key: k,
        ...v,
      }));

      arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setPatients(arr);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { patients, loading };
};