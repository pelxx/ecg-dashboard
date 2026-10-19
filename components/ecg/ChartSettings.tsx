
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
              type="button"
              onClick={() => onSensitivityChange(button.value)}
              className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                settings.sensitivity === button.value
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                  : "border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] hover:opacity-80"
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
              type="button"
              onClick={() => onWindowChange(button.value)}
              className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                settings.windowMs === button.value
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                  : "border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] hover:opacity-80"
              }`}
            >
              {button.label}
            </button>
          ))}
        </ControlGroup>

        <div className="grid grid-cols-2 gap-2">
          <Toggle
            label="Auto Scale"
            checked={settings.autoScale}
            onChange={onAutoScaleChange}
          />
          <Toggle
            label={settings.frozen ? "Resume" : "Freeze"}
            checked={settings.frozen}
            onChange={onFrozenChange}
          />
          <Toggle
            label="Grid"
            checked={settings.showGrid}
            onChange={onGridChange}
          />
        </div>

        <ControlGroup label="Lead Toggle">
          {ECG_LEADS.map((lead) => (
            <button
              key={lead.key}
              type="button"
              onClick={() => onLeadToggle(lead.key)}
              className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                settings.visibleLeads[lead.key]
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                  : "border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--foreground)] hover:opacity-80"
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
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
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
    <label className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[var(--primary)]"
      />
    </label>
  );
}

export default ChartSettings;
