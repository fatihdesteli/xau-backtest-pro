"use client";

import { useEffect, useRef, useState } from "react";
import type { CloseReason } from "@/lib/types";

interface TradeResult {
  pnl: number;
  pips: number;
  rMultiple: number | null;
  direction: "long" | "short";
  closeReason: CloseReason;
  entryPrice: number;
  exitPrice: number;
  lotSize: number;
}

interface Props {
  result: TradeResult | null;
  onDone: () => void;
}

const REASON_LABELS: Record<CloseReason, string> = {
  tp:     "Take Profit ✓",
  sl:     "Stop Loss ✗",
  manual: "Manuel Kapanış",
  time:   "Zaman Kapanışı",
};

export default function TradeCloseToast({ result, onDone }: Props) {
  const [phase, setPhase] = useState<"enter" | "show" | "exit" | "done">("done");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!result) return;

    // Reset then animate in
    setPhase("enter");
    timerRef.current = setTimeout(() => setPhase("show"), 50);
    timerRef.current = setTimeout(() => setPhase("exit"), 2600);
    timerRef.current = setTimeout(() => { setPhase("done"); onDone(); }, 3100);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === "done" || !result) return null;

  const isWin  = result.pnl > 0;
  const isTP   = result.closeReason === "tp";
  const isSL   = result.closeReason === "sl";

  const primaryColor = isWin ? "#22c55e" : "#ef4444";
  const bgColor      = isWin ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)";
  const borderColor  = isWin ? "rgba(34,197,94,0.3)"  : "rgba(239,68,68,0.3)";
  const glowColor    = isWin ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)";

  const scale     = phase === "show" ? 1    : phase === "enter" ? 0.6  : 0.8;
  const opacity   = phase === "show" ? 1    : phase === "enter" ? 0    : 0;
  const blur      = phase === "show" ? 0    : phase === "enter" ? 4    : 8;
  const transition = phase === "enter"
    ? "all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)"
    : "all 0.4s ease-in";

  const pnlStr   = `${result.pnl >= 0 ? "+" : ""}$${Math.abs(result.pnl).toFixed(2)}`;
  const pipsStr  = `${result.pips >= 0 ? "+" : ""}${Math.abs(result.pips).toFixed(1)} pips`;
  const rStr     = result.rMultiple !== null
    ? `${result.rMultiple >= 0 ? "+" : ""}${result.rMultiple.toFixed(2)}R`
    : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
    >
      {/* Backdrop glow */}
      <div
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          background: `radial-gradient(ellipse at center, ${glowColor} 0%, transparent 70%)`,
          opacity: phase === "show" ? 1 : 0,
        }}
      />

      {/* Card */}
      <div
        className="relative flex flex-col items-center gap-4 px-12 py-8 rounded-2xl"
        style={{
          background: bgColor,
          border: `1px solid ${borderColor}`,
          backdropFilter: "blur(20px)",
          boxShadow: `0 0 60px ${glowColor}, 0 20px 60px rgba(0,0,0,0.5)`,
          transform: `scale(${scale})`,
          opacity,
          filter: `blur(${blur}px)`,
          transition,
          minWidth: 320,
        }}
      >
        {/* Icon */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: primaryColor + "20", border: `2px solid ${primaryColor}40` }}
        >
          {isWin ? (
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke={primaryColor} strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke={primaryColor} strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>

        {/* Win/Loss label */}
        <div className="text-center">
          <div
            className="text-xs font-semibold uppercase tracking-widest mb-1"
            style={{ color: primaryColor + "aa" }}
          >
            {REASON_LABELS[result.closeReason]}
          </div>

          {/* Big P&L */}
          <div
            className="font-black tracking-tight leading-none"
            style={{
              fontSize: 56,
              color: primaryColor,
              textShadow: `0 0 30px ${primaryColor}60`,
            }}
          >
            {pnlStr}
          </div>
        </div>

        {/* Details row */}
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <div className="text-gray-500 text-xs mb-0.5">Pips</div>
            <div className="font-mono font-semibold" style={{ color: primaryColor }}>
              {pipsStr}
            </div>
          </div>
          {rStr && (
            <>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <div className="text-gray-500 text-xs mb-0.5">R Katsayısı</div>
                <div className="font-mono font-semibold" style={{ color: primaryColor }}>
                  {rStr}
                </div>
              </div>
            </>
          )}
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <div className="text-gray-500 text-xs mb-0.5">Yön</div>
            <div
              className="text-xs font-bold px-2 py-0.5 rounded"
              style={{ background: primaryColor + "20", color: primaryColor }}
            >
              {result.direction === "long" ? "▲ LONG" : "▼ SHORT"}
            </div>
          </div>
        </div>

        {/* Entry → Exit */}
        <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
          <span>{result.entryPrice.toFixed(2)}</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          <span className="text-white">{result.exitPrice.toFixed(2)}</span>
          <span className="ml-1 text-gray-600">({result.lotSize} lot)</span>
        </div>

        {/* Progress bar (timer) */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-2xl overflow-hidden">
          <div
            className="h-full transition-none"
            style={{
              background: primaryColor,
              width: phase === "show" ? "0%" : "100%",
              transition: phase === "show" ? "width 2.5s linear" : "none",
            }}
          />
        </div>
      </div>
    </div>
  );
}
