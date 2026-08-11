export type PatientGender = "Laki-laki" | "Perempuan" | string;

export interface PatientProfile {
  readonly patientId: string;
  readonly patientName: string;
  readonly age: number;
  readonly gender: PatientGender;
  readonly heightCm?: number;
  readonly weightKg?: number;
  readonly bloodType?: string;
  readonly doctor?: string;
  readonly medicalRecord?: string;
  readonly room?: string;
  readonly admissionDate?: number;
}
