"use client";

import { useBacktestStore } from "@/lib/store";
import type { DrawingToolType } from "@/lib/types";
import { DRAWING_COLORS } from "@/lib/constants";
import { useState } from "react";

const TOOLS: { key: DrawingToolType; label: string; icon: React.ReactNode }[] = [
  {
    key: "none",
    label: "Seçim",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
      </svg>
    ),
  },
  {
    key: "trendline",
    label: "Trend Çizgisi",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 20L21 4" />
      </svg>
    ),
  },
  {
    key: "ray",
    label: "Işın",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l18-8M3 12l18 8" />
      </svg>
    ),
  },
  {
    key: "horizontal",
    label: "Yatay Çizgi",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12h18" />
      </svg>
    ),
  },
  {
    key: "vertical",
    label: "Dikey Çizgi",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3v18" />
      </svg>
    ),
  },
  {
    key: "rectangle",
    label: "Dikdörtgen",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <rect x="3" y="6" width="18" height="12" rx="1" strokeWidth={1.8} />
      </svg>
    ),
  },
  {
    key: "fibonacci",
    label: "Fibonacci",
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 20l18-16M3 14h18M3 8h18" />
      </svg>
    ),
  },
];

interface Props {
  onColorChange?: (color: string) => void;
  activeColor?: string;
}

export default function DrawingToolbar({ onColorChange, activeColor = "#3b82f6" }: Props) {
  const activeTool = useBacktestStore((s) => s.activeTool);
  const setActiveTool = useBacktestStore((s) => s.setActiveTool);
  const clearDrawings = useBacktestStore((s) => s.clearDrawings);
  const drawings = useBacktestStore((s) => s.drawings);
  const removeDrawing = useBacktestStore((s) => s.removeDrawing);
  const selectedDrawingId = useBacktestStore((s) => s.selectedDrawingId);
  const setSelectedDrawingId = useBacktestStore((s) => s.setSelectedDrawingId);

  const [showColors, setShowColors] = useState(false);

  const handleTool = (key: DrawingToolType) => {
    setActiveTool(activeTool === key && key !== "none" ? "none" : key);
    setSelectedDrawingId(null);
  };

  return (
    <div className="flex flex-col gap-1 py-2 px-1">
      {/* Tools */}
      {TOOLS.map(({ key, label, icon }) => (
        <button
          key={key}
          onClick={() => handleTool(key)}
          title={label}
          className={`
            relative group flex items-center justify-center w-8 h-8 rounded
            transition-all duration-150 text-gray-400 hover:text-white
            ${activeTool === key
              ? "bg-blue-600/20 text-blue-400 border border-blue-600/40"
              : "hover:bg-white/5"
            }
          `}
        >
          {icon}
          {/* Tooltip */}
          <span className="absolute left-10 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap px-2 py-1 text-xs bg-gray-800 text-gray-200 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity border border-gray-700">
            {label}
          </span>
        </button>
      ))}

      {/* Divider */}
      <div className="w-6 h-px bg-white/10 mx-1 my-1" />

      {/* Color picker */}
      <div className="relative">
        <button
          onClick={() => setShowColors((v) => !v)}
          title="Renk Seç"
          className="flex items-center justify-center w-8 h-8 rounded hover:bg-white/5 transition-colors"
        >
          <div
            className="w-4 h-4 rounded-full border border-white/20"
            style={{ background: activeColor }}
          />
        </button>
        {showColors && (
          <div className="absolute left-10 top-0 z-50 flex flex-wrap gap-1.5 p-2 rounded-lg bg-gray-900 border border-gray-700 shadow-xl"
            style={{ width: 120 }}>
            {DRAWING_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => { onColorChange?.(c); setShowColors(false); }}
                className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                style={{
                  background: c,
                  borderColor: activeColor === c ? "white" : "transparent",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="w-6 h-px bg-white/10 mx-1 my-1" />

      {/* Delete selected drawing */}
      {selectedDrawingId && (
        <button
          onClick={() => { removeDrawing(selectedDrawingId); setSelectedDrawingId(null); }}
          title="Seçili Çizimi Sil"
          className="flex items-center justify-center w-8 h-8 rounded hover:bg-red-600/20 text-red-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}

      {/* Clear all drawings */}
      {drawings.length > 0 && (
        <button
          onClick={clearDrawings}
          title="Tüm Çizimleri Temizle"
          className="flex items-center justify-center w-8 h-8 rounded hover:bg-red-600/10 text-gray-600 hover:text-red-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
              d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
          </svg>
        </button>
      )}
    </div>
  );
}
