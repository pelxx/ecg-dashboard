"use client";

import { useEffect } from "react";
import mqtt, { MqttClient } from "mqtt";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";

export default function MQTTListener() {
  useEffect(() => {
    // 🔹 Buat koneksi MQTT
    const client: MqttClient = mqtt.connect("wss://broker.emqx.io:8084/mqtt");

    client.on("connect", () => {
      console.log("✅ Connected to MQTT broker");

      // 🔹 Subscribe semua topik ECG dengan pola ecg/{patientId}/realtime
      client.subscribe("ecg/+/realtime", (err) => {
        if (err) console.error("❌ Failed to subscribe:", err);
        else console.log("📡 Subscribed to ecg/+/realtime");
      });
    });

    // 🔹 Ketika pesan MQTT diterima
    client.on("message", async (topic: string, message: Buffer) => {
      try {
        const parts = topic.split("/");
        const patientId = parts[1]; // topic format: ecg/{patientId}/realtime

        if (!patientId) {
          console.error("❌ Missing patientId in topic:", topic);
          return;
        }

        const data = JSON.parse(message.toString());
        console.log(`📩 Data received for ${patientId}:`, data);

        // 🔹 Simpan data ke Firestore
        await addDoc(collection(db, "ecg_records"), {
          patientId,
          timestamp: Date.now(),
          ...data,
        });
      } catch (err) {
        console.error("❌ Error handling MQTT message:", err);
      }
    });

    // 🔹 Cleanup: disconnect ketika komponen unmount
    return () => {
      client.end(true, () => console.log("🔌 MQTT disconnected"));
    };
  }, []);

  return null; // tidak render UI, hanya listener global
}
