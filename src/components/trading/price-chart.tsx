import { useEffect, useRef } from "react";
import { calculateEMA, type Candle } from "@/lib/trading";

export function PriceChart({
  candles,
  precision,
  indicators,
  line,
  zoom,
  expanded,
  source,
}: {
  candles: Candle[];
  precision: number;
  indicators: boolean;
  line: boolean;
  zoom: number;
  expanded: boolean;
  source?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(ratio, ratio);
      const css = getComputedStyle(document.documentElement);
      const token = (name: string) => css.getPropertyValue(name).trim();
      const w = rect.width,
        h = rect.height,
        right = 65,
        left = 15,
        top = 52,
        bottom = h - 79;
      const data = candles.slice(-Math.max(25, 76 - zoom * 15));
      const closes = data.map((c) => c.close);
      const hi = Math.max(...data.map((c) => c.high)),
        lo = Math.min(...data.map((c) => c.low)),
        pad = (hi - lo) * 0.15;
      const min = lo - pad,
        max = hi + pad;
      const y = (v: number) => top + ((max - v) / (max - min)) * (bottom - top);
      const dx = (w - right - left) / data.length;
      const x = (i: number) => left + dx * (i + 0.5);
      ctx.font = '10px "JetBrains Mono", monospace';
      for (let i = 0; i < 6; i++) {
        const val = min + ((max - min) * i) / 5;
        const yp = y(val);
        ctx.strokeStyle = token("--chart-grid");
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(left, yp);
        ctx.lineTo(w - right, yp);
        ctx.stroke();
        ctx.fillStyle = token("--muted-foreground");
        ctx.fillText(val.toFixed(precision), w - right + 9, yp + 3);
      }
      for (let i = 0; i < data.length; i += 12) {
        ctx.strokeStyle = token("--chart-grid");
        ctx.beginPath();
        ctx.moveTo(x(i), top - 12);
        ctx.lineTo(x(i), h - 33);
        ctx.stroke();
        ctx.fillStyle = token("--muted-foreground");
        ctx.fillText(
          new Date(data[i]?.timestamp ?? 0).toISOString().slice(11, 16),
          x(i) - 15,
          h - 14,
        );
      }
      const path = (values: number[], color: string, width = 1) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        values.forEach((v, i) => (i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v))));
        ctx.stroke();
      };
      if (indicators) {
        const mids = closes.map((_, i) => {
          const list = closes.slice(Math.max(0, i - 19), i + 1);
          return list.reduce((a, b) => a + b, 0) / list.length;
        });
        path(
          mids.map((v) => v + (hi - lo) * 0.2),
          token("--chart-band"),
        );
        path(
          mids.map((v) => v - (hi - lo) * 0.2),
          token("--chart-band"),
        );
        path(calculateEMA(closes, 9), token("--chart-fast"), 1.3);
        path(calculateEMA(closes, 21), token("--chart-slow"), 1.3);
      }
      if (line) path(closes, token("--primary"), 1.6);
      data.forEach((c, i) => {
        const color = token(c.close >= c.open ? "--positive" : "--negative");
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        if (!line) {
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x(i), y(c.high));
          ctx.lineTo(x(i), y(c.low));
          ctx.stroke();
          ctx.fillRect(
            x(i) - Math.max(2, dx * 0.31),
            Math.min(y(c.open), y(c.close)),
            Math.max(3, dx * 0.62),
            Math.max(1.5, Math.abs(y(c.open) - y(c.close))),
          );
        }
        ctx.globalAlpha = 0.22;
        ctx.fillRect(x(i) - dx * 0.3, h - 35, dx * 0.6, -(7 + Math.abs(Math.sin(i * 2.7)) * 25));
        ctx.globalAlpha = 1;
      });
      const last = data.at(-1);
      if (last) {
        const yp = y(last.close);
        ctx.strokeStyle = token("--positive");
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(left, yp);
        ctx.lineTo(w - right, yp);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = token("--positive");
        ctx.fillRect(w - right, yp - 10, right, 20);
        ctx.fillStyle = token("--primary-foreground");
        ctx.fillText(last.close.toFixed(precision), w - right + 7, yp + 3);
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [candles, precision, indicators, line, zoom, expanded]);
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={`${source ?? "Market"} candlestick price chart with EMA indicators and volume`}
    />
  );
}
