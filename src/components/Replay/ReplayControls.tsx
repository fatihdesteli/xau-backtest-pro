"use client";

import { useEffect, useRef, useCallback } from "react";
import { useBacktestStore } from "@/lib/store";
import { REPLAY_SPEEDS } from "@/lib/constants";

export default function ReplayControls() {
  const candles = useBacktestStore((s) => s.candles);
  const currentBarIndex = useBacktestStore((s) => s.currentBarIndex);
  const stepForward = useBacktestStore((s) => s.stepForward);
  const stepBackward = useBacktestStore((s) => s.stepBackward);
  const setCurrentBarIndex = useBacktestStore((s) => s.setCurrentBarIndex);
  const isReplaying = useBacktestStore((s) => s.isReplaying);
  const replaySpeed = useBacktestStore((s) => s.replaySpeed);
  const setReplaying = useBacktestStore((s) => s.setReplaying);
  const setReplaySpeed = useBacktestStore((s) => s.setReplaySpeed);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const total = candles.length;
  const atEnd = currentBarIndex >= total - 1;
  const atStart = currentBarIndex <= 0;

  // ── Auto-play ─────────────────────────────────────────────────────────────
  const stopReplay = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setReplaying(false);
  }, [setReplaying]);

  useEffect(() => {
    if (!isReplaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    if (atEnd) {
      stopReplay();
      return;
    }
    const delay = Math.max(50, 1000 / replaySpeed);
    intervalRef.current = setInterval(() => {
      const cur = useBacktestStore.getState().currentBarIndex;
      const total = useBacktestStore.getState().candles.length;
      if (cur >= total - 1) {
        stopReplay();
      } else {
        useBacktestStore.getState().stepForward(1);
      }
    }, delay);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isReplaying, replaySpeed, atEnd, stopReplay]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) stepForward(10);
          else stepForward(1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) stepBackward(10);
          else stepBackward(1);
          break;
        case " ":
          e.preventDefault();
          if (isReplaying) stopReplay();
          else if (!atEnd) setReplaying(true);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isReplaying, atEnd, stepForward, stepBackward, stopReplay, setReplaying]);

  const progress = total > 0 ? (currentBarIndex / (total - 1)) * 100 : 0;

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[#111] border-t border-[#1e2028] select-none">
      {/* Step backward 10 */}
      <button
        onClick={() => stepBackward(10)}
        disabled={atStart}
        title="10 bar geri (Shift+←)"
        className="btn btn-ghost disabled:opacity-30 p-1.5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
      </button>

      {/* Step backward 1 */}
      <button
        onClick={() => stepBackward(1)}
        disabled={atStart}
        title="1 bar geri (←)"
        className="btn btn-ghost disabled:opacity-30 p-1.5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* Play / Pause */}
      <button
        onClick={() => isReplaying ? stopReplay() : setReplaying(true)}
        disabled={atEnd}
        title={isReplaying ? "Duraklat (Space)" : "Oynat (Space)"}
        className={`
          flex items-center justify-center w-9 h-9 rounded-full transition-all
          ${isReplaying
            ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
            : "bg-blue-600 text-white hover:bg-blue-500"
          }
          disabled:opacity-30 disabled:cursor-not-allowed
        `}
      >
        {isReplaying ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Step forward 1 */}
      <button
        onClick={() => stepForward(1)}
        disabled={atEnd}
        title="1 bar ileri (→)"
        className="btn btn-ghost disabled:opacity-30 p-1.5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Step forward 10 */}
      <button
        onClick={() => stepForward(10)}
        disabled={atEnd}
        title="10 bar ileri (Shift+→)"
        className="btn btn-ghost disabled:opacity-30 p-1.5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      </button>

      {/* Speed selector */}
      <div className="flex items-center gap-1 ml-2">
        {REPLAY_SPEEDS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => { setReplaySpeed(value); if (isReplaying) { stopReplay(); setTimeout(() => setReplaying(true), 50); } }}
            className={`
              px-2 py-0.5 text-xs rounded transition-colors
              ${replaySpeed === value
                ? "bg-blue-600 text-white"
                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }
            `}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Progress bar + scrubber */}
      <div className="flex-1 mx-3 flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={total - 1}
          value={currentBarIndex}
          onChange={(e) => {
            stopReplay();
            setCurrentBarIndex(Number(e.target.value));
          }}
          className="flex-1 h-1 appearance-none bg-gray-700 rounded-full cursor-pointer"
          style={{
            background: `linear-gradient(to right, #2563eb ${progress}%, #374151 ${progress}%)`,
          }}
        />
        <span className="text-xs text-gray-500 whitespace-nowrap font-mono">
          {currentBarIndex + 1} / {total}
        </span>
      </div>

      {/* Jump to start/end */}
      <button
        onClick={() => { stopReplay(); setCurrentBarIndex(0); }}
        title="Başa git"
        className="btn btn-ghost p-1.5 text-gray-600 hover:text-gray-300"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M18 12H5" />
        </svg>
      </button>
      <button
        onClick={() => { stopReplay(); setCurrentBarIndex(total - 1); }}
        title="Sona git"
        className="btn btn-ghost p-1.5 text-gray-600 hover:text-gray-300"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M6 12h13" />
        </svg>
      </button>

      {/* Keyboard hint */}
      <div className="ml-1 text-xs text-gray-700 hidden xl:block">
        ← → Space
      </div>
    </div>
  );
}
