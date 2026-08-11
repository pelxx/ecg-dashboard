"use client";

import React, { memo } from "react";
import MedicalCard from "@/components/common/MedicalCard";
import StatusBadge from "@/components/common/StatusBadge";
import type { PatientProfile } from "@/types/patient";
import { getBpmTone } from "@/utils/ecg";
type Props = {
  readonly patient: PatientProfile;
  readonly deviceId: string;
  readonly bpm: number;
  readonly isRecording: boolean;
};

const PatientInfo = memo(function PatientInfo({
  patient,
  deviceId,
  bpm,
  isRecording,

}: Props) {


  const rows = [
    ["Patient ID", patient.patientId],
    ["Device ID", deviceId],
    ["Age", patient.age ? `${patient.age} years` : "--"],
    ["Gender", patient.gender || "--"],
  ] as const;

  return (
    <MedicalCard
      title="Patient Information"
      action={
        <StatusBadge
          label={isRecording ? "Recording" : "Idle"}
          tone={isRecording ? "red" : "gray"}
        />
      }
    >
      <div className="mb-4">
        <p className="text-lg font-semibold text-white">{patient.patientName}</p>
        <p className="font-mono text-xs text-slate-500">
          {patient.patientId}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {rows.map(([label, value]) => (
          <React.Fragment key={label}>
            <dt className="text-slate-500">{label}</dt>
            <dd className="min-w-0 truncate text-right text-slate-100">{value}</dd>
          </React.Fragment>
        ))}
      </dl>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-emerald-800/30 pt-4">
        <div>
          <p className="text-xs text-slate-500">Current BPM</p>
          <p className={`text-4xl font-bold ${getBpmTone(bpm)}`}>
            {bpm > 0 ? bpm : "--"}
            <span className="ml-2 text-base font-normal text-slate-400">BPM</span>
          </p>
        </div>
      </div>
    </MedicalCard>
  );
});

export default PatientInfo;
