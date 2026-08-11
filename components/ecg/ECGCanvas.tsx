"use client";

import { memo, useEffect, useRef } from "react";
import {
  ADC_HALF_RANGE,
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
    };
  }, [autoScale, frozen, sampleRateHz, sensitivity, showGrid, windowMs]);

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
    <div className="rounded-lg border border-emerald-900/40 bg-black/70 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-emerald-300">{title}</p>
        <p className="text-xs text-slate-500">
          {sampleRateHz} Hz / {(windowMs / 1000).toFixed(1)}s
        </p>
      </div>
      <div ref={containerRef} className="h-56 w-full md:h-64">
        <canvas ref={canvasRef} className="block rounded bg-black" />
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
  const centerY = top + plotHeight / 2;
  const amplitude = plotHeight * 0.42;

  context.fillStyle = "#050806";
  context.fillRect(0, 0, width, height);

  if (options.showGrid) {
    drawGrid(context, width, height, left, right, top, bottom, dpr);
  }

  context.strokeStyle = "rgba(110, 231, 183, 0.45)";
  context.lineWidth = dpr;
  context.beginPath();
  context.moveTo(left, top);
  context.lineTo(left, height - bottom);
  context.lineTo(width - right, height - bottom);
  context.stroke();

  context.fillStyle = "#86efac";
  context.font = `${12 * dpr}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  context.textBaseline = "middle";
  context.textAlign = "right";

  for (const tick of [-1, 0, 1]) {
    const y = centerY - tick * amplitude * 0.5;
    context.fillText(`${tick} mV`, left - 8 * dpr, y);
  }

  if (data.length === 0) {
    drawEmptyState(context, width, height, dpr);
    return;
  }

  const latestTimestamp = data[data.length - 1]?.timestamp ?? Date.now();
  const startTime = latestTimestamp - options.windowMs;
  const gain = gainForSensitivity(options.sensitivity);
  const scale = options.autoScale || options.sensitivity === "auto"
    ? getAutoScale(data, startTime)
    : gain;

  context.save();
  context.beginPath();
  context.rect(left, top, plotWidth, plotHeight);
  context.clip();
  context.beginPath();
  context.strokeStyle = "#22f27a";
  context.lineWidth = Math.max(1.4 * dpr, 1);
  context.lineJoin = "round";
  context.lineCap = "round";

  let moved = false;
  for (let index = 0; index < data.length; index += 1) {
    const point = data[index];
    if (point.timestamp < startTime) continue;

    const progress = (point.timestamp - startTime) / options.windowMs;
    const x = left + progress * plotWidth;
    const normalized = normalizeEcgValue(point.value);
    const y = centerY - normalized * scale * amplitude;

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
  const gradient = context.createLinearGradient(cursorX, 0, cursorX + 44 * dpr, 0);
  gradient.addColorStop(0, "rgba(5, 8, 6, 0.92)");
  gradient.addColorStop(1, "rgba(5, 8, 6, 0)");
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
  dpr: number
) {
  const small = 20 * dpr;
  const large = small * 5;
  const plotRight = width - right;
  const plotBottom = height - bottom;

  context.lineWidth = Math.max(0.5 * dpr, 0.5);
  context.strokeStyle = "rgba(16, 185, 129, 0.08)";
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

  context.lineWidth = Math.max(0.8 * dpr, 0.8);
  context.strokeStyle = "rgba(16, 185, 129, 0.18)";
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

function getAutoScale(data: readonly ECGDataPoint[], startTime: number): number {
  let maxAbs = 1 / ADC_HALF_RANGE;

  for (let index = data.length - 1; index >= 0; index -= 1) {
    const point = data[index];
    if (point.timestamp < startTime) break;
    maxAbs = Math.max(maxAbs, Math.abs(normalizeEcgValue(point.value)));
  }

  return Math.min(4, Math.max(0.4, 0.8 / maxAbs));
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
