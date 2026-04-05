import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import type {
  Trade,
  BacktestSession,
  DrawingObject,
  DrawingToolType,
  AppSettings,
  Timeframe,
  Instrument,
  TradeStats,
  OHLCVCandle,
  CloseReason,
} from "./types";
import {
  DEFAULT_SETTINGS,
  calcPnl,
  calcPips,
  calcRMultiple,
  LS_SETTINGS,
  LS_DRAWINGS,
} from "./constants";
import * as fb from "./firebase";

// ─── Helper ───────────────────────────────────────────────────────────────────
function genId(): string {
  return uuidv4();
}

// ─── Backtest Store ───────────────────────────────────────────────────────────

interface BacktestStore {
  // ── Settings ──
  settings: AppSettings;
  updateSettings: (s: Partial<AppSettings>) => void;

  // ── Session ──
  session: BacktestSession | null;
  createSession: (name: string, instrument: Instrument, timeframe: Timeframe) => BacktestSession;
  loadSession: (session: BacktestSession) => void;
  updateCurrentBarIndex: (index: number) => void;

  // ── Candles ──
  candles: OHLCVCandle[];
  visibleCandles: OHLCVCandle[];
  setCandles: (candles: OHLCVCandle[]) => void;
  currentBarIndex: number;
  setCurrentBarIndex: (index: number) => void;
  stepForward: (count?: number) => void;
  stepBackward: (count?: number) => void;

  // ── Replay ──
  isReplaying: boolean;
  replaySpeed: number;
  setReplaying: (v: boolean) => void;
  setReplaySpeed: (v: number) => void;

  // ── Trades ──
  trades: Trade[];
  openTrade: (params: {
    direction: "long" | "short";
    entryPrice: number;
    lotSize: number;
    stopLoss?: number;
    takeProfit?: number;
  }) => Trade;
  closeTrade: (id: string, exitPrice: number, reason: CloseReason) => void;
  updateTradeLevel: (id: string, field: "stopLoss" | "takeProfit", value: number | null) => void;
  updateTradeNotes: (id: string, notes: string) => void;
  deleteTrade: (id: string) => void;
  setTrades: (trades: Trade[]) => void;

  // ── Drawings ──
  drawings: DrawingObject[];
  activeTool: DrawingToolType;
  selectedDrawingId: string | null;
  addDrawing: (d: DrawingObject) => void;
  updateDrawing: (id: string, d: Partial<DrawingObject>) => void;
  removeDrawing: (id: string) => void;
  clearDrawings: () => void;
  setActiveTool: (t: DrawingToolType) => void;
  setSelectedDrawingId: (id: string | null) => void;

  // ── Stats ──
  getStats: () => TradeStats;

  // ── Firebase sync ──
  firebaseEnabled: boolean;
  setFirebaseEnabled: (v: boolean) => void;
  syncToFirebase: () => Promise<void>;
  loadFromFirebase: (sessionId: string) => Promise<void>;
}

export const useBacktestStore = create<BacktestStore>()(
  persist(
    (set, get) => ({
      // ── Settings ──
      settings: DEFAULT_SETTINGS,
      updateSettings: (s) =>
        set((state) => ({ settings: { ...state.settings, ...s } })),

      // ── Session ──
      session: null,
      createSession: (name, instrument, timeframe) => {
        const session: BacktestSession = {
          id: genId(),
          name,
          instrument,
          accountSize: get().settings.accountSize,
          riskPerTrade: get().settings.riskPerTrade,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          startBarIndex: 0,
          currentBarIndex: 0,
          timeframe,
          tradeIds: [],
          isActive: true,
        };
        set({ session, trades: [], drawings: [], currentBarIndex: 0 });
        if (get().firebaseEnabled) {
          fb.saveSession(session).catch(console.error);
        }
        return session;
      },
      loadSession: (session) => set({ session, currentBarIndex: session.currentBarIndex }),
      updateCurrentBarIndex: (index) => {
        const session = get().session;
        if (session) {
          const updated = { ...session, currentBarIndex: index, updatedAt: Date.now() };
          set({ session: updated });
          if (get().firebaseEnabled) {
            fb.updateSession(session.id, { currentBarIndex: index, updatedAt: Date.now() }).catch(console.error);
          }
        }
      },

      // ── Candles ──
      candles: [],
      visibleCandles: [],
      setCandles: (candles) => set({ candles, currentBarIndex: Math.min(200, candles.length - 1) }),
      currentBarIndex: 0,
      setCurrentBarIndex: (index) => {
        const { candles } = get();
        const clamped = Math.max(0, Math.min(index, candles.length - 1));
        set({ currentBarIndex: clamped });
        get().updateCurrentBarIndex(clamped);
      },
      stepForward: (count = 1) => {
        const { currentBarIndex, candles } = get();
        const next = Math.min(currentBarIndex + count, candles.length - 1);
        set({ currentBarIndex: next });
        get().updateCurrentBarIndex(next);
      },
      stepBackward: (count = 1) => {
        const { currentBarIndex } = get();
        const prev = Math.max(currentBarIndex - count, 0);
        set({ currentBarIndex: prev });
        get().updateCurrentBarIndex(prev);
      },

      // ── Replay ──
      isReplaying: false,
      replaySpeed: 2,
      setReplaying: (v) => set({ isReplaying: v }),
      setReplaySpeed: (v) => set({ replaySpeed: v }),

      // ── Trades ──
      trades: [],
      openTrade: ({ direction, entryPrice, lotSize, stopLoss, takeProfit }) => {
        const { session, currentBarIndex, candles } = get();
        const candle = candles[currentBarIndex];
        const trade: Trade = {
          id: genId(),
          instrument: session?.instrument ?? "XAUUSD",
          timeframe: session?.timeframe ?? "15m",
          direction,
          status: "open",
          entryPrice,
          entryTime: candle?.time ?? Date.now() / 1000,
          entryBarIndex: currentBarIndex,
          lotSize,
          stopLoss: stopLoss ?? null,
          takeProfit: takeProfit ?? null,
          exitPrice: null,
          exitTime: null,
          exitBarIndex: null,
          closeReason: null,
          pnl: null,
          pips: null,
          rMultiple: null,
          notes: "",
          screenshot: null,
          createdAt: Date.now(),
          sessionId: session?.id ?? "local",
        };
        set((state) => ({
          trades: [...state.trades, trade],
          session: state.session
            ? { ...state.session, tradeIds: [...state.session.tradeIds, trade.id] }
            : state.session,
        }));
        if (get().firebaseEnabled) {
          fb.saveTrade(trade).catch(console.error);
        }
        return trade;
      },
      closeTrade: (id, exitPrice, reason) => {
        const { trades, candles, currentBarIndex } = get();
        const candle = candles[currentBarIndex];
        set((state) => ({
          trades: state.trades.map((t) => {
            if (t.id !== id || t.status !== "open") return t;
            const pnl = calcPnl(t.direction, t.entryPrice, exitPrice, t.lotSize, t.instrument);
            const pips = calcPips(t.direction, t.entryPrice, exitPrice);
            const rMultiple = calcRMultiple(pnl, t.entryPrice, t.stopLoss, t.lotSize, t.instrument);
            const updated: Trade = {
              ...t,
              status: "closed",
              exitPrice,
              exitTime: candle?.time ?? Date.now() / 1000,
              exitBarIndex: currentBarIndex,
              closeReason: reason,
              pnl,
              pips,
              rMultiple,
            };
            if (get().firebaseEnabled) {
              fb.updateTrade(id, updated).catch(console.error);
            }
            return updated;
          }),
        }));
      },
      updateTradeLevel: (id, field, value) => {
        set((state) => ({
          trades: state.trades.map((t) => {
            if (t.id !== id) return t;
            const updated = { ...t, [field]: value };
            if (get().firebaseEnabled) {
              fb.updateTrade(id, { [field]: value }).catch(console.error);
            }
            return updated;
          }),
        }));
      },
      updateTradeNotes: (id, notes) => {
        set((state) => ({
          trades: state.trades.map((t) => {
            if (t.id !== id) return t;
            if (get().firebaseEnabled) {
              fb.updateTrade(id, { notes }).catch(console.error);
            }
            return { ...t, notes };
          }),
        }));
      },
      deleteTrade: (id) => {
        set((state) => ({
          trades: state.trades.filter((t) => t.id !== id),
        }));
        if (get().firebaseEnabled) {
          fb.deleteTrade(id).catch(console.error);
        }
      },
      setTrades: (trades) => set({ trades }),

      // ── Drawings ──
      drawings: [],
      activeTool: "none",
      selectedDrawingId: null,
      addDrawing: (d) => set((state) => ({ drawings: [...state.drawings, d] })),
      updateDrawing: (id, d) =>
        set((state) => ({
          drawings: state.drawings.map((dr) => (dr.id === id ? { ...dr, ...d } : dr)),
        })),
      removeDrawing: (id) =>
        set((state) => ({ drawings: state.drawings.filter((d) => d.id !== id) })),
      clearDrawings: () => set({ drawings: [] }),
      setActiveTool: (t) => set({ activeTool: t }),
      setSelectedDrawingId: (id) => set({ selectedDrawingId: id }),

      // ── Stats ──
      getStats: () => {
        const { trades } = get();
        const closed = trades.filter((t) => t.status === "closed");
        const open = trades.filter((t) => t.status === "open");
        const winners = closed.filter((t) => (t.pnl ?? 0) > 0);
        const losers = closed.filter((t) => (t.pnl ?? 0) <= 0);
        const totalPnl = closed.reduce((s, t) => s + (t.pnl ?? 0), 0);
        const totalPips = closed.reduce((s, t) => s + (t.pips ?? 0), 0);
        const avgWin = winners.length > 0 ? winners.reduce((s, t) => s + (t.pnl ?? 0), 0) / winners.length : 0;
        const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((s, t) => s + (t.pnl ?? 0), 0) / losers.length) : 0;
        const grossWin = winners.reduce((s, t) => s + (t.pnl ?? 0), 0);
        const grossLoss = Math.abs(losers.reduce((s, t) => s + (t.pnl ?? 0), 0));
        const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0;
        const rValues = closed.filter((t) => t.rMultiple !== null).map((t) => t.rMultiple!);
        const avgRMultiple = rValues.length > 0 ? rValues.reduce((s, v) => s + v, 0) / rValues.length : 0;

        // Max drawdown
        let peak = 0, maxDD = 0, runningPnl = 0;
        closed.forEach((t) => {
          runningPnl += t.pnl ?? 0;
          if (runningPnl > peak) peak = runningPnl;
          const dd = peak - runningPnl;
          if (dd > maxDD) maxDD = dd;
        });

        const pnlValues = closed.map((t) => t.pnl ?? 0);

        return {
          totalTrades: closed.length,
          openTrades: open.length,
          winners: winners.length,
          losers: losers.length,
          winRate: closed.length > 0 ? (winners.length / closed.length) * 100 : 0,
          totalPnl,
          totalPips,
          avgWin,
          avgLoss,
          profitFactor,
          avgRMultiple: Math.round(avgRMultiple * 100) / 100,
          maxDrawdown: maxDD,
          bestTrade: pnlValues.length > 0 ? Math.max(...pnlValues) : 0,
          worstTrade: pnlValues.length > 0 ? Math.min(...pnlValues) : 0,
          longsCount: closed.filter((t) => t.direction === "long").length,
          shortsCount: closed.filter((t) => t.direction === "short").length,
        };
      },

      // ── Firebase sync ──
      firebaseEnabled: false,
      setFirebaseEnabled: (v) => set({ firebaseEnabled: v }),
      syncToFirebase: async () => {
        const { trades, session } = get();
        if (session) await fb.saveSession(session);
        await Promise.all(trades.map((t) => fb.saveTrade(t)));
      },
      loadFromFirebase: async (sessionId) => {
        const sessions = await fb.getAllSessions();
        const session = sessions.find((s) => s.id === sessionId);
        if (session) {
          const trades = await fb.getTradesBySession(sessionId);
          set({ session, trades, currentBarIndex: session.currentBarIndex });
        }
      },
    }),
    {
      name: LS_SETTINGS,
      partialize: (state) => ({
        settings: state.settings,
        session: state.session,
        trades: state.trades,
        drawings: state.drawings,
        currentBarIndex: state.currentBarIndex,
        replaySpeed: state.replaySpeed,
        firebaseEnabled: state.firebaseEnabled,
      }),
    }
  )
);
