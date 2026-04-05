import type { Timeframe, TimeframeConfig, AppSettings, Instrument } from "./types";

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const APP_PASSWORD = "fatihdesteli";
export const AUTH_KEY = "bt_auth";

// ─── Instruments ──────────────────────────────────────────────────────────────
export const INSTRUMENTS: Instrument[] = ["XAUUSD"];

export const INSTRUMENT_CONFIG: Record<string, { label: string; pipValue: number; pointValue: number; digits: number }> = {
  XAUUSD: {
    label: "XAU/USD",
    pipValue: 1.0,    // $1 per pip per standard lot
    pointValue: 0.01, // 1 pip = $0.01 price movement
    digits: 2,
  },
};

// ─── Timeframes ───────────────────────────────────────────────────────────────
export const TIMEFRAMES: Timeframe[] = ["1m", "5m", "15m", "1h", "4h", "1D"];

export const TIMEFRAME_CONFIG: Record<Timeframe, TimeframeConfig> = {
  "1m":  { label: "1M",  seconds: 60,       dataFile: "xauusd_1m.json"  },
  "5m":  { label: "5M",  seconds: 300,      dataFile: "xauusd_5m.json"  },
  "15m": { label: "15M", seconds: 900,      dataFile: "xauusd_15m.json" },
  "1h":  { label: "1H",  seconds: 3600,     dataFile: "xauusd_1h.json"  },
  "4h":  { label: "4H",  seconds: 14400,    dataFile: "xauusd_4h.json"  },
  "1D":  { label: "1D",  seconds: 86400,    dataFile: "xauusd_1d.json"  },
};

// ─── Default Settings ─────────────────────────────────────────────────────────
export const DEFAULT_SETTINGS: AppSettings = {
  accountSize: 10000,
  defaultLotSize: 0.1,
  riskPerTrade: 1,
  defaultSLPips: 200,
  defaultTPPips: 400,
  pipValue: 1.0,
  pointValue: 0.01,
  autoPlaySpeed: 2,
  theme: "dark",
};

// ─── Drawing Tool Colors ──────────────────────────────────────────────────────
export const DRAWING_COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#ef4444", // red
  "#f59e0b", // yellow
  "#a855f7", // purple
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ffffff", // white
];

export const DEFAULT_DRAWING_COLOR = "#3b82f6";

// ─── Chart Colors ─────────────────────────────────────────────────────────────
export const CHART_COLORS = {
  background: "#0d0d0d",
  grid: "#1a1a1a",
  text: "#94a3b8",
  crosshair: "#444444",
  bullCandle: "#22c55e",
  bearCandle: "#ef4444",
  bullBorder: "#16a34a",
  bearBorder: "#dc2626",
  tpLine: "#22c55e",
  slLine: "#ef4444",
  entryLine: "#3b82f6",
  longFill: "rgba(34, 197, 94, 0.08)",
  shortFill: "rgba(239, 68, 68, 0.08)",
};

// ─── Replay Speeds ────────────────────────────────────────────────────────────
export const REPLAY_SPEEDS = [
  { label: "0.5x", value: 0.5 },
  { label: "1x",   value: 1 },
  { label: "2x",   value: 2 },
  { label: "5x",   value: 5 },
  { label: "10x",  value: 10 },
];

// ─── Pip/Point Calculations ───────────────────────────────────────────────────
// For XAUUSD: 1 pip = $0.10 move, but we'll treat 1.00 = 1 "point"
// Standard: 1 lot = 100 oz. $1/oz movement = $100 P&L per lot
// So for 0.1 lot, $1/oz = $10 P&L
export function calcPnl(
  direction: "long" | "short",
  entryPrice: number,
  exitPrice: number,
  lotSize: number,
  instrument: Instrument
): number {
  const cfg = INSTRUMENT_CONFIG[instrument];
  const diff = direction === "long" ? exitPrice - entryPrice : entryPrice - exitPrice;
  // For XAUUSD: 1 lot = 100 oz
  return diff * lotSize * 100;
}

export function calcPips(
  direction: "long" | "short",
  entryPrice: number,
  exitPrice: number
): number {
  const diff = direction === "long" ? exitPrice - entryPrice : entryPrice - exitPrice;
  return Math.round(diff * 100) / 10; // 1 pip = $0.10
}

export function calcRMultiple(
  pnl: number,
  entryPrice: number,
  stopLoss: number | null,
  lotSize: number,
  instrument: Instrument
): number | null {
  if (!stopLoss) return null;
  const riskPnl = Math.abs(calcPnl("long", entryPrice, stopLoss, lotSize, instrument));
  if (riskPnl === 0) return null;
  return Math.round((pnl / riskPnl) * 100) / 100;
}

export function calcLotFromRisk(
  accountSize: number,
  riskPct: number,
  entryPrice: number,
  stopLoss: number,
  instrument: Instrument
): number {
  const riskAmount = accountSize * (riskPct / 100);
  const pipsDiff = Math.abs(entryPrice - stopLoss);
  if (pipsDiff === 0) return 0.01;
  // For XAUUSD: 1 lot * $1 move = $100
  const lotSize = riskAmount / (pipsDiff * 100);
  return Math.max(0.01, Math.round(lotSize * 100) / 100);
}

// ─── Local Storage Keys ───────────────────────────────────────────────────────
export const LS_SETTINGS = "bt_settings";
export const LS_SESSION  = "bt_session";
export const LS_DRAWINGS = "bt_drawings";
