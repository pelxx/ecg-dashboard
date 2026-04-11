"use client";
import { useEffect, useRef } from "react";

type Point = { timestamp?: number; value: number };
type Sensitivity = "auto" | "half" | "standard" | "double";
type Props = {
  data: Point[];
  title?: string;
  windowMs?: number;
  sampleRateHz?: number;
  sensitivity?: Sensitivity;
};

const SAMPLE_RATE_HZ = 500;
const DEFAULT_WINDOW_MS = 5000;
const ADC_CENTER = 512;
const ADC_HALF_RANGE = 700;

export default function ECGCanvasSweep({
  data,
  title,
  windowMs = DEFAULT_WINDOW_MS,
  sampleRateHz = SAMPLE_RATE_HZ,
  sensitivity = "standard",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const bufferSize = Math.max(1, Math.ceil((windowMs / 1000) * sampleRateHz));

  const bufferRef = useRef<number[]>(new Array(bufferSize).fill(0));
  const timeBufferRef = useRef<number[]>(new Array(bufferSize).fill(0));
  const writeIdxRef = useRef(0);
  const filledRef = useRef(0);
  const lastTimestampRef = useRef<number | null>(null);
  const firstTimestampRef = useRef<number | null>(null);

  useEffect(() => {
    bufferRef.current = new Array(bufferSize).fill(0);
    timeBufferRef.current = new Array(bufferSize).fill(0);
    writeIdxRef.current = 0;
    filledRef.current = 0;
    lastTimestampRef.current = null;
    firstTimestampRef.current = null;
  }, [bufferSize]);

  useEffect(() => {
    if (!data) return;

    const freshPoints = data.filter((p) => {
      if (typeof p.timestamp !== "number") return true;
      return lastTimestampRef.current === null || p.timestamp > lastTimestampRef.current;
    });

    freshPoints.forEach((p) => {
      bufferRef.current[writeIdxRef.current] = p.value;
      timeBufferRef.current[writeIdxRef.current] =
        typeof p.timestamp === "number" ? p.timestamp : Date.now();
      writeIdxRef.current = (writeIdxRef.current + 1) % bufferSize;
      filledRef.current = Math.min(filledRef.current + 1, bufferSize);

      if (typeof p.timestamp === "number") {
        if (firstTimestampRef.current === null) {
          firstTimestampRef.current = p.timestamp;
        }
        lastTimestampRef.current = p.timestamp;
      }
    });
  }, [data, bufferSize]);

  useEffect(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;

    const render = () => {
      const W = canvas.width;
      const H = canvas.height;
      const axisLeft = 52;
      const axisRight = 10;
      const axisTop = 10;
      const axisBottom = 45;
      const plotW = W - axisLeft - axisRight;
      const plotH = H - axisTop - axisBottom;
      const mid = axisTop + plotH / 2;
      const amp = plotH * 0.45;
      const gain =
        sensitivity === "half" ? 0.5 : sensitivity === "double" ? 2 : 1;
      const normalizeValue = (value: number) =>
        Math.abs(value) <= 5 ? value : (value - ADC_CENTER) / ADC_HALF_RANGE;
      const valueToY = (value: number, scale = gain) =>
        mid - normalizeValue(value) * scale * amp;

      // background
      ctx.fillStyle = "#070d07";
      ctx.fillRect(0, 0, W, H);

      // grid kecil
      ctx.strokeStyle = "rgba(0,180,80,0.08)";
      ctx.lineWidth = 0.5;
      for (let x = axisLeft; x <= W - axisRight; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, axisTop);
        ctx.lineTo(x, H - axisBottom);
        ctx.stroke();
      }

      for (let y = axisTop; y <= H - axisBottom; y += 20) {
        ctx.beginPath();
        ctx.moveTo(axisLeft, y);
        ctx.lineTo(W - axisRight, y);
        ctx.stroke();
      }

      // grid besar
      ctx.strokeStyle = "rgba(0,180,80,0.18)";
      for (let x = axisLeft; x <= W - axisRight; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, axisTop);
        ctx.lineTo(x, H - axisBottom);
        ctx.stroke();
      }

      // axes and labels
      ctx.strokeStyle = "rgba(154,230,180,0.65)";
      ctx.fillStyle = "#9ae6b4";
      ctx.lineWidth = 1;
      ctx.font = "18px monospace";
      ctx.textBaseline = "middle";

      ctx.beginPath();
      ctx.moveTo(axisLeft, axisTop);
      ctx.lineTo(axisLeft, H - axisBottom);
      ctx.lineTo(W - axisRight, H - axisBottom);
      ctx.stroke();

      const adcTicks = [256, 512, 768, 1023];
      ctx.textAlign = "right";
      adcTicks.forEach((tick) => {
        const y = valueToY(tick, sensitivity === "auto" ? 1 : gain);
        if (y < axisTop || y > H - axisBottom) return;
        ctx.beginPath();
        ctx.moveTo(axisLeft - 5, y);
        ctx.lineTo(axisLeft, y);
        ctx.stroke();
        ctx.fillText(String(tick), axisLeft - 8, y);
      });

      ctx.textAlign = "left";
      ctx.fillText("ADC", 6, axisTop + 10);

      // ECG line
      const buf = bufferRef.current;
      const timeBuf = timeBufferRef.current;
      const writeIdx = writeIdxRef.current;

      ctx.beginPath();
      ctx.strokeStyle = "#00e676";
      ctx.lineWidth = 1.5;

      const visibleSamples = Math.min(filledRef.current, bufferSize);
      const xStep = plotW / Math.max(visibleSamples - 1, 1);
      const startIdx = (writeIdx - visibleSamples + bufferSize) % bufferSize;
      const firstVisibleTs = timeBuf[startIdx] || firstTimestampRef.current;
      let autoMaxAbs = 1;

      if (sensitivity === "auto") {
        for (let i = 0; i < visibleSamples; i++) {
          const bufIdx = (startIdx + i) % bufferSize;
          autoMaxAbs = Math.max(autoMaxAbs, Math.abs(normalizeValue(buf[bufIdx])));
        }
      }

      for (let i = 0; i < visibleSamples; i++) {
        const x = axisLeft + i * xStep;
        const bufIdx = (startIdx + i) % bufferSize;
        const normalized = normalizeValue(buf[bufIdx]);
        const scaled =
          sensitivity === "auto" ? normalized / autoMaxAbs : normalized * gain;
        const y = mid - scaled * amp;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.stroke();

      ctx.fillStyle = "#9ae6b4";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      const xTickCount = 5;
      for (let i = 0; i <= xTickCount; i++) {
        const x = axisLeft + (plotW * i) / xTickCount;
        const sampleOffset = Math.round(
          ((visibleSamples - 1) * i) / xTickCount
        );
        const bufIdx = (startIdx + sampleOffset) % bufferSize;
        const ts = timeBuf[bufIdx];
        const elapsed =
          firstVisibleTs && ts ? (ts - firstVisibleTs) / 1000 : (windowMs / 1000) * (i / xTickCount);

        ctx.beginPath();
        ctx.moveTo(x, H - axisBottom);
        ctx.lineTo(x, H - axisBottom + 5);
        ctx.stroke();
        ctx.fillText(`${elapsed.toFixed(1)}s`, x, H - axisBottom + 8);
      }

      ctx.textAlign = "right";
      ctx.fillText("Detik", W - axisRight, H - 20);

      // sweep effect
      const cursorX = axisLeft + (writeIdx / bufferSize) * plotW;
      const gradient = ctx.createLinearGradient(cursorX, 0, cursorX + 40, 0);
      gradient.addColorStop(0, "rgba(7,13,7,0.95)");
      gradient.addColorStop(1, "rgba(7,13,7,0)");

      ctx.fillStyle = gradient;
      ctx.fillRect(cursorX, 0, 40, H);

      rafRef.current = requestAnimationFrame(render);
    };
    
    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [bufferSize, sensitivity]);

  return (
  <div>
    {title && (
      <p className="text-green-400 text-sm mb-1">{title}</p>
    )}
    <canvas
      ref={canvasRef}
      width={1200}
      height={280}
      className="w-full rounded"
    />
  </div>
);
}
