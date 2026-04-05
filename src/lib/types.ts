// ─── Candle / OHLCV ───────────────────────────────────────────────────────────

export interface OHLCVCandle {
  time: number; // Unix timestamp (seconds)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

// ─── Timeframes ───────────────────────────────────────────────────────────────

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1D";

export interface TimeframeConfig {
  label: string;
  seconds: number;
  dataFile: string;
}

// ─── Instruments ──────────────────────────────────────────────────────────────

export type Instrument = "XAUUSD";

// ─── Trade Direction ──────────────────────────────────────────────────────────

export type TradeDirection = "long" | "short";

export type TradeStatus = "open" | "closed" | "cancelled";

export type CloseReason = "manual" | "tp" | "sl" | "time";

// ─── Trade ────────────────────────────────────────────────────────────────────

export interface Trade {
  id: string;
  instrument: Instrument;
  timeframe: Timeframe;
  direction: TradeDirection;
  status: TradeStatus;

  // Entry
  entryPrice: number;
  entryTime: number; // unix timestamp
  entryBarIndex: number;
  lotSize: number;

  // Levels
  stopLoss: number | null;
  takeProfit: number | null;

  // Exit
  exitPrice: number | null;
  exitTime: number | null;
  exitBarIndex: number | null;
  closeReason: CloseReason | null;

  // P&L
  pnl: number | null; // in USD
  pips: number | null;
  rMultiple: number | null; // R:R achieved

  // Meta
  notes: string;
  screenshot: string | null; // base64 or URL
  createdAt: number;
  sessionId: string;
}

// ─── Session ──────────────────────────────────────────────────────────────────

export interface BacktestSession {
  id: string;
  name: string;
  instrument: Instrument;
  accountSize: number;
  riskPerTrade: number; // percentage
  createdAt: number;
  updatedAt: number;
  startBarIndex: number;
  currentBarIndex: number;
  timeframe: Timeframe;
  tradeIds: string[];
  isActive: boolean;
}

// ─── Drawing Tools ────────────────────────────────────────────────────────────

export type DrawingToolType =
  | "none"
  | "trendline"
  | "horizontal"
  | "vertical"
  | "rectangle"
  | "fibonacci"
  | "ray";

export interface Point {
  time: number;
  price: number;
}

export interface DrawingObject {
  id: string;
  type: DrawingToolType;
  points: Point[];
  color: string;
  lineWidth: number;
  lineStyle: "solid" | "dashed" | "dotted";
  label?: string;
  locked: boolean;
}

// ─── App State ────────────────────────────────────────────────────────────────

export interface AppSettings {
  accountSize: number;
  defaultLotSize: number;
  riskPerTrade: number; // %
  defaultSLPips: number;
  defaultTPPips: number;
  pipValue: number; // USD per pip per lot (XAUUSD = $1)
  pointValue: number; // XAUUSD: 0.01
  autoPlaySpeed: number; // candles per second
  theme: "dark";
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface TradeStats {
  totalTrades: number;
  openTrades: number;
  winners: number;
  losers: number;
  winRate: number;
  totalPnl: number;
  totalPips: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  avgRMultiple: number;
  maxDrawdown: number;
  bestTrade: number;
  worstTrade: number;
  longsCount: number;
  shortsCount: number;
}

// ─── Chart Drawing State ──────────────────────────────────────────────────────

export interface ChartState {
  currentBarIndex: number;
  visibleBars: number;
  activeTool: DrawingToolType;
  drawings: DrawingObject[];
  isReplaying: boolean;
  replaySpeed: number;
  selectedDrawingId: string | null;
}

// ─── Firebase ─────────────────────────────────────────────────────────────────

export interface FirestoreTrade extends Trade {
  _docId?: string;
}

export interface FirestoreSession extends BacktestSession {
  _docId?: string;
}
