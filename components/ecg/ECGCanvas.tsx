"use client";

import { memo, useEffect, useRef } from "react";
import {
  DEFAULT_ECG_WINDOW_MS,
  ECG_SAMPLE_RATE_HZ,
} from "@/constants/ecg";
import type { ECGDataPoint, ECGSensitivity } from "@/types/ecg";
import { normalizeEcgValue } from "@/utils/ecg";

type Props = {
  readonly data: readonly ECGDataPoint[];
  readonly title: string;
  readonly windowMs?: number;
  readonly sampleRateHz?: number;
  readonly sensitivity?: ECGSensitivity;
  readonly autoScale?: boolean;
  readonly frozen?: boolean;
  readonly showGrid?: boolean;
};

const gainForSensitivity = (sensitivity: ECGSensitivity): number => {
  if (sensitivity === "half") return 0.5;
  if (sensitivity === "double") return 2;
  return 1;
};

const STANDARD_Y_MIN_MV = -4;
const STANDARD_Y_MAX_MV = 4;
const STANDARD_Y_TICKS_MV = [-4, -2, 0, 2, 4] as const;

type YAxisScale = {
  readonly minMv: number;
  readonly maxMv: number;
  readonly ticks: readonly number[];
};

const ECGCanvas = memo(function ECGCanvas({
  data,
  title,
  windowMs = DEFAULT_ECG_WINDOW_MS,
  sampleRateHz = ECG_SAMPLE_RATE_HZ,
  sensitivity = "standard",
  autoScale = false,
  frozen = false,
  showGrid = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const dataRef = useRef<readonly ECGDataPoint[]>(data);
  const propsRef = useRef({
    windowMs,
    sampleRateHz,
    sensitivity,
    autoScale,
    frozen,
    showGrid,
    isDark:true
  });

  useEffect(() => {
    if (!frozen) dataRef.current = data;
  }, [data, frozen]);

  useEffect(() => {
    propsRef.current = {
      windowMs,
      sampleRateHz,
      sensitivity,
      autoScale,
      frozen,
      showGrid,
      isDark: document.documentElement.classList.contains("dark"),
    };
  }, [autoScale, frozen, sampleRateHz, sensitivity, showGrid, windowMs]);

  useEffect(() => {
  const observer = new MutationObserver(() => {
    propsRef.current = {
      ...propsRef.current,
      isDark: document.documentElement.classList.contains("dark"),
    };
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  return () => observer.disconnect();
}, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(320, Math.floor(rect.width));
      const height = Math.max(180, Math.floor(rect.height));

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !context) return;

    const render = () => {
      drawECG(context, canvas, dataRef.current, propsRef.current);
      rafRef.current = window.requestAnimationFrame(render);
    };

    rafRef.current = window.requestAnimationFrame(render);
    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

     return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 transition-colors duration-200">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[var(--success)]">
          {title}
        </p>
        <p className="text-xs text-[var(--text-secondary)]">
          {sampleRateHz} Hz / {(windowMs / 1000).toFixed(1)}s
        </p>
      </div>
      <div ref={containerRef} className="h-56 w-full md:h-64">
        <canvas
          ref={canvasRef}
          className="block rounded"
        />
      </div>
    </div>
  );
});

function drawECG(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  data: readonly ECGDataPoint[],
  options: {
    readonly windowMs: number;
    readonly sampleRateHz: number;
    readonly sensitivity: ECGSensitivity;
    readonly autoScale: boolean;
    readonly frozen: boolean;
    readonly showGrid: boolean;
    readonly isDark: boolean;
  }
) {
  const width = canvas.width;
  const height = canvas.height;
  const dpr = window.devicePixelRatio || 1;
  const left = 48 * dpr;
  const right = 12 * dpr;
  const top = 10 * dpr;
  const bottom = 34 * dpr;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  context.fillStyle = options.isDark ? "#050806" : "#FFFFFF";
  context.fillRect(0, 0, width, height);

  if (options.showGrid) {
    drawGrid(context, width, height, left, right, top, bottom, dpr, options.isDark);
  }

  context.strokeStyle = options.isDark
    ? "rgba(110, 231, 183, 0.45)"
    : "rgba(22, 163, 74, 0.45)";
  context.lineWidth = dpr;
  context.beginPath();
  context.moveTo(left, top);
  context.lineTo(left, height - bottom);
  context.lineTo(width - right, height - bottom);
  context.stroke();

  const latestTimestamp = data[data.length - 1]?.timestamp ?? Date.now();
  const startTime = latestTimestamp - options.windowMs;
  const shouldAutoScale = options.sensitivity === "auto";
  const yAxis = shouldAutoScale
    ? getAutoYAxisScale(data, startTime)
    : getFixedYAxisScale(gainForSensitivity(options.sensitivity));

  drawYAxisLabels(context, yAxis, left, top, plotHeight, dpr, options.isDark);

  if (data.length === 0) {
    drawEmptyState(context, width, height, dpr);
    return;
  }

  context.save();
  context.beginPath();
  context.rect(left, top, plotWidth, plotHeight);
  context.clip();
  context.beginPath();
  context.strokeStyle = options.isDark ? "#22f27a" : "#15803D";
  context.lineWidth = Math.max(1.4 * dpr, 1);
  context.lineJoin = "round";
  context.lineCap = "round";

  let moved = false;
  for (let index = 0; index < data.length; index += 1) {
    const point = data[index];
    if (point.timestamp < startTime) continue;

    const progress = (point.timestamp - startTime) / options.windowMs;
    const x = left + progress * plotWidth;
    const millivolts = normalizeEcgValue(point.value);
    const y = toCanvasY(millivolts, yAxis, top, plotHeight);

    if (!moved) {
      context.moveTo(x, y);
      moved = true;
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();

  const cursorProgress = ((latestTimestamp % options.windowMs) / options.windowMs);
  const cursorX = left + cursorProgress * plotWidth;
  const gradient = context.createLinearGradient(
  cursorX,
  0,
  cursorX + 44 * dpr,
  0
);

gradient.addColorStop(
  0,
  options.isDark
    ? "rgba(5, 8, 6, 0.92)"
    : "rgba(255, 255, 255, 0.92)"
);

gradient.addColorStop(
  1,
  options.isDark
    ? "rgba(5, 8, 6, 0)"
    : "rgba(255, 255, 255, 0)"
);
  context.fillStyle = gradient;
  context.fillRect(cursorX, top, 44 * dpr, plotHeight);
  context.restore();
}

function drawGrid(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  left: number,
  right: number,
  top: number,
  bottom: number,
  dpr: number,
  isDark: boolean,
) {
  // Tampilan grid ECG: kotak kecil dan besar
  const small = 10 * dpr;
  const large = small * 5;

  const plotRight = width - right;
  const plotBottom = height - bottom;

  // Garis grid kecil
  context.lineWidth = Math.max(0.5 * dpr, 0.5);
  context.strokeStyle = isDark
  ? "rgba(220, 80, 100, 0.14)"
  : "rgba(220, 80, 100, 0.22)";

  for (let x = left; x <= plotRight; x += small) {
    context.beginPath();
    context.moveTo(x, top);
    context.lineTo(x, plotBottom);
    context.stroke();
  }

  for (let y = top; y <= plotBottom; y += small) {
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(plotRight, y);
    context.stroke();
  }

  // Garis grid besar setiap 5 kotak kecil
  context.lineWidth = Math.max(0.9 * dpr, 0.9);
  context.strokeStyle = isDark
  ? "rgba(220, 80, 100, 0.30)"
  : "rgba(220, 80, 100, 0.40)";

  for (let x = left; x <= plotRight; x += large) {
    context.beginPath();
    context.moveTo(x, top);
    context.lineTo(x, plotBottom);
    context.stroke();
  }

  for (let y = top; y <= plotBottom; y += large) {
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(plotRight, y);
    context.stroke();
  }
}


function getFixedYAxisScale(gain: number): YAxisScale {
  return {
    minMv: STANDARD_Y_MIN_MV / gain,
    maxMv: STANDARD_Y_MAX_MV / gain,
    ticks: STANDARD_Y_TICKS_MV.map((tick) => tick / gain),
  };
}

function getAutoYAxisScale(
  data: readonly ECGDataPoint[],
  startTime: number
): YAxisScale {
  let minMv = Number.POSITIVE_INFINITY;
  let maxMv = Number.NEGATIVE_INFINITY;

  for (let index = data.length - 1; index >= 0; index -= 1) {
    const point = data[index];
    if (point.timestamp < startTime) break;

    const millivolts = normalizeEcgValue(point.value);
    minMv = Math.min(minMv, millivolts);
    maxMv = Math.max(maxMv, millivolts);
  }

  if (!Number.isFinite(minMv) || !Number.isFinite(maxMv)) {
    return getFixedYAxisScale(1);
  }

  const span = maxMv - minMv;
  const padding = span > 0 ? span * 0.1 : Math.max(Math.abs(maxMv) * 0.1, 0.5);
  const paddedMin = minMv - padding;
  const paddedMax = maxMv + padding;

  return {
    minMv: paddedMin,
    maxMv: paddedMax,
    ticks: Array.from(
      { length: 5 },
      (_, index) => paddedMin + ((paddedMax - paddedMin) * index) / 4
    ),
  };
}

function toCanvasY(
  millivolts: number,
  yAxis: YAxisScale,
  top: number,
  plotHeight: number
): number {
  const progress = (yAxis.maxMv - millivolts) / (yAxis.maxMv - yAxis.minMv);
  return top + progress * plotHeight;
}

function drawYAxisLabels(
  context: CanvasRenderingContext2D,
  yAxis: YAxisScale,
  left: number,
  top: number,
  plotHeight: number,
  dpr: number,
  isDark: boolean
) {
  context.fillStyle = isDark ? "#86efac" : "#166534";
  context.font = `${12 * dpr}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  context.textBaseline = "middle";
  context.textAlign = "right";

  for (const tick of yAxis.ticks) {
    const y = toCanvasY(tick, yAxis, top, plotHeight);
    context.fillText(`${formatMillivolts(tick)} mV`, left - 8 * dpr, y);
  }
}

function formatMillivolts(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function drawEmptyState(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  dpr: number
) {
  context.fillStyle = "#64748b";
  context.font = `${13 * dpr}px Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("Waiting for ECG signal", width / 2, height / 2);
}

export default ECGCanvas;
