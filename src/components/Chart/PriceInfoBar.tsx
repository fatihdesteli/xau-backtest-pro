"use client";

import { useBacktestStore } from "@/lib/store";
import { INSTRUMENT_CONFIG } from "@/lib/constants";

interface Props {
  crosshairPrice: number | null;
}

export default function PriceInfoBar({ crosshairPrice }: Props) {
  const candles = useBacktestStore((s) => s.candles);
  const currentBarIndex = useBacktestStore((s) => s.currentBarIndex);
  const session = useBacktestStore((s) => s.session);

  const candle = candles[currentBarIndex];
  const prevCandle = currentBarIndex > 0 ? candles[currentBarIndex - 1] : null;
  if (!candle) return null;

  const instrument = session?.instrument ?? "XAUUSD";
  const cfg = INSTRUMENT_CONFIG[instrument];
  const digits = cfg.digits;

  const change = prevCandle ? candle.close - prevCandle.close : 0;
  const changePct = prevCandle ? (change / prevCandle.close) * 100 : 0;
  const isUp = change >= 0;

  const fmt = (v: number) => v.toFixed(digits);

  // Format date
  const date = new Date(candle.time * 1000);
  const dateStr = date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex items-center gap-4 px-3 py-1.5 text-xs font-mono border-b border-[#1e2028] bg-[#0d0d0d] select-none">
      {/* Symbol */}
      <span className="text-white font-semibold text-sm font-sans mr-1">{cfg.label}</span>

      {/* OHLC */}
      <span className="text-gray-500">O</span>
      <span className="text-gray-300">{fmt(candle.open)}</span>
      <span className="text-gray-500">H</span>
      <span className="text-green-400">{fmt(candle.high)}</span>
      <span className="text-gray-500">L</span>
      <span className="text-red-400">{fmt(candle.low)}</span>
      <span className="text-gray-500">C</span>
      <span className={isUp ? "text-green-400" : "text-red-400"}>{fmt(candle.close)}</span>

      {/* Change */}
      <span className={`${isUp ? "text-green-400" : "text-red-400"}`}>
        {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(digits)} ({Math.abs(changePct).toFixed(2)}%)
      </span>

      {/* Volume */}
      {candle.volume !== undefined && candle.volume > 0 && (
        <>
          <span className="text-gray-500">V</span>
          <span className="text-gray-400">{candle.volume.toLocaleString()}</span>
        </>
      )}

      {/* Crosshair price */}
      {crosshairPrice !== null && (
        <span className="ml-2 text-yellow-300 font-semibold">
          ⊕ {crosshairPrice.toFixed(digits)}
        </span>
      )}

      {/* Date / Bar info */}
      <span className="ml-auto text-gray-500">
        {dateStr} {timeStr}
      </span>
      <span className="text-gray-600">
        Bar {currentBarIndex + 1} / {candles.length}
      </span>
    </div>
  );
}
