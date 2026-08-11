"use client";

import { memo } from "react";
import MedicalCard from "@/components/common/MedicalCard";
import {
  ECG_LEADS,
  ECG_PAPER_SPEEDS,
  ECG_SENSITIVITIES,
} from "@/constants/ecg";
import type {
  ECGChartSettings,
  ECGLeadKey,
  ECGSensitivity,
} from "@/types/ecg";

type Props = {
  readonly settings: ECGChartSettings;
  readonly onWindowChange: (speedMs: number) => void;
  readonly onSensitivityChange: (sensitivity: ECGSensitivity) => void;
  readonly onAutoScaleChange: (enabled: boolean) => void;
  readonly onFrozenChange: (enabled: boolean) => void;
  readonly onGridChange: (enabled: boolean) => void;
  readonly onLeadToggle: (lead: ECGLeadKey) => void;
};

const ChartSettings = memo(function ChartSettings({
  settings,
  onWindowChange,
  onSensitivityChange,
  onAutoScaleChange,
  onFrozenChange,
  onGridChange,
  onLeadToggle,
}: Props) {
  return (
    <MedicalCard title="Chart Settings">
      <div className="space-y-4">
        <ControlGroup label="Gain">
          {ECG_SENSITIVITIES.map((button) => (
            <button
              key={button.value}
              onClick={() => onSensitivityChange(button.value)}
              className={`rounded px-3 py-1.5 text-xs ${
                settings.sensitivity === button.value
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-800 text-slate-300"
              }`}
            >
              {button.label}
            </button>
          ))}
        </ControlGroup>

        <ControlGroup label="Paper Speed">
          {ECG_PAPER_SPEEDS.map((button) => (
            <button
              key={button.value}
              onClick={() => onWindowChange(button.value)}
              className={`rounded px-3 py-1.5 text-xs ${
                settings.windowMs === button.value
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-800 text-slate-300"
              }`}
            >
              {button.label}
            </button>
          ))}
        </ControlGroup>

        <div className="grid grid-cols-2 gap-2">
          <Toggle label="Auto Scale" checked={settings.autoScale} onChange={onAutoScaleChange} />
          <Toggle label={settings.frozen ? "Resume" : "Freeze"} checked={settings.frozen} onChange={onFrozenChange} />
          <Toggle label="Grid" checked={settings.showGrid} onChange={onGridChange} />
        </div>

        <ControlGroup label="Lead Toggle">
          {ECG_LEADS.map((lead) => (
            <button
              key={lead.key}
              onClick={() => onLeadToggle(lead.key)}
              className={`rounded px-3 py-1.5 text-xs ${
                settings.visibleLeads[lead.key]
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {lead.label}
            </button>
          ))}
        </ControlGroup>
      </div>
    </MedicalCard>
  );
});

function ControlGroup({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-400">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 rounded border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-emerald-500"
      />
    </label>
  );
}

export default ChartSettings;
