import type { DeviceCard } from "@/types/device";
import type { PatientProfile } from "@/types/patient";

export const getPatientFromDevice = (device: DeviceCard): PatientProfile =>
  device.assignment;
