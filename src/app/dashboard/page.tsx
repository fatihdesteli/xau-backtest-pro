"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useBacktestStore } from "@/lib/store";
import { AUTH_KEY, TIMEFRAME_CONFIG } from "@/lib/constants";
import type { Timeframe } from "@/lib/types";

import TopBar from "@/components/UI/TopBar";
import BacktestChart, { type BacktestChartHandle } from "@/components/Chart/BacktestChart";
import PriceInfoBar from "@/components/Chart/PriceInfoBar";
import DrawingToolbar from "@/components/Chart/DrawingToolbar";
import ReplayControls from "@/components/Replay/ReplayControls";
import TradePanel from "@/components/Trade/TradePanel";
import StatsPanel from "@/components/Stats/StatsPanel";

type PanelTab = "trade" | "stats";

export default function DashboardPage() {
  const router = useRouter();
  const chartRef = useRef<BacktestChartHandle>(null);

  const setCandles = useBacktestStore((s) => s.setCandles);
  const session = useBacktestStore((s) => s.session);
  const createSession = useBacktestStore((s) => s.createSession);
  const candles = useBacktestStore((s) => s.candles);
  const currentBarIndex = useBacktestStore((s) => s.currentBarIndex);
  const trades = useBacktestStore((s) => s.trades);
  const closeTrade = useBacktestStore((s) => s.closeTrade);
  const setActiveTool = useBacktestStore((s) => s.setActiveTool);

  const [currentTimeframe, setCurrentTimeframe] = useState<Timeframe>(
    (session?.timeframe as Timeframe) ?? "15m"
  );
  const [crosshairPrice, setCrosshairPrice] = useState<number | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PanelTab>("trade");
  const [drawingColor, setDrawingColor] = useState("#3b82f6");
  const [rightPanelOpen, setRightPanelOpen] = useState(true);

  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== "undefined" && !sessionStorage.getItem(AUTH_KEY)) {
      router.replace("/");
    }
  }, [router]);

  // ── Init session on first load ──────────────────────────────────────────────
  useEffect(() => {
    if (!session) {
      createSession("İlk Backtest", "XAUUSD", currentTimeframe);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load candle data when timeframe changes ─────────────────────────────────
  const loadData = useCallback(async (tf: Timeframe) => {
    setIsLoadingData(true);
    setDataError(null);
    try {
      const cfg = TIMEFRAME_CONFIG[tf];
      const res = await fetch(`/data/${cfg.dataFile}`);
      if (!res.ok) throw new Error(`Veri yüklenemedi: ${cfg.dataFile}`);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Veri boş veya geçersiz format");
      }
      setCandles(data);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setIsLoadingData(false);
    }
  }, [setCandles]);

  useEffect(() => {
    loadData(currentTimeframe);
  }, [currentTimeframe, loadData]);

  // ── Auto-close trades at TP/SL on each bar advance ─────────────────────────
  useEffect(() => {
    const candle = candles[currentBarIndex];
    if (!candle) return;

    const openTrades = trades.filter((t) => t.status === "open");
    openTrades.forEach((trade) => {
      // Check SL hit
      if (trade.stopLoss !== null) {
        const slHit = trade.direction === "long"
          ? candle.low <= trade.stopLoss
          : candle.high >= trade.stopLoss;
        if (slHit) {
          closeTrade(trade.id, trade.stopLoss, "sl");
          return;
        }
      }
      // Check TP hit
      if (trade.takeProfit !== null) {
        const tpHit = trade.direction === "long"
          ? candle.high >= trade.takeProfit
          : candle.low <= trade.takeProfit;
        if (tpHit) {
          closeTrade(trade.id, trade.takeProfit, "tp");
          return;
        }
      }
    });
  }, [currentBarIndex, candles, trades, closeTrade]);

  const handleTimeframeChange = (tf: Timeframe) => {
    setCurrentTimeframe(tf);
  };

  const handleChartClick = useCallback((time: number, price: number, x: number, y: number) => {
    // Drawing tool handling is done inside BacktestChart via chart events
    // This callback can be used for future interactions
  }, []);

  const currentPrice = candles[currentBarIndex]?.close ?? null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Navigation Bar */}
      <TopBar
        onTimeframeChange={handleTimeframeChange}
        currentTimeframe={currentTimeframe}
      />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Drawing Toolbar (left sidebar) */}
        <div className="w-10 bg-[#111] border-r border-[#1e2028] flex flex-col items-center shrink-0">
          <DrawingToolbar
            activeColor={drawingColor}
            onColorChange={setDrawingColor}
          />
        </div>

        {/* Chart area */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* OHLC info bar */}
          <PriceInfoBar crosshairPrice={crosshairPrice} />

          {/* Chart */}
          <div className="flex-1 relative min-h-0">
            {isLoadingData && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d0d] z-20">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-gray-500">Veri yükleniyor...</span>
                </div>
              </div>
            )}
            {dataError && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d0d] z-20">
                <div className="flex flex-col items-center gap-3 max-w-sm text-center px-6">
                  <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm text-red-400 font-medium mb-1">Veri yüklenemedi</p>
                    <p className="text-xs text-gray-500">{dataError}</p>
                    <p className="text-xs text-gray-600 mt-2">
                      Lütfen: <code className="bg-gray-800 px-1 rounded">node scripts/generate_sample_data.js</code> çalıştırın
                    </p>
                  </div>
                  <button
                    onClick={() => loadData(currentTimeframe)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white transition-colors"
                  >
                    Tekrar Dene
                  </button>
                </div>
              </div>
            )}
            {!isLoadingData && !dataError && (
              <BacktestChart
                ref={chartRef}
                onCrosshairPrice={setCrosshairPrice}
                onChartClick={handleChartClick}
              />
            )}
          </div>

          {/* Replay Controls */}
          <ReplayControls />
        </div>

        {/* Right Panel toggle button */}
        <button
          onClick={() => setRightPanelOpen((v) => !v)}
          className="w-4 bg-[#111] border-l border-[#1e2028] flex items-center justify-center hover:bg-white/5 transition-colors shrink-0"
          title={rightPanelOpen ? "Paneli Gizle" : "Paneli Göster"}
        >
          <svg
            className={`w-3 h-3 text-gray-600 transition-transform ${rightPanelOpen ? "" : "rotate-180"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Right sidebar (trade panel + stats) */}
        {rightPanelOpen && (
          <div className="w-72 flex flex-col bg-[#111] border-l border-[#1e2028] shrink-0 overflow-hidden">
            {/* Tab header */}
            <div className="flex border-b border-[#1e2028] shrink-0">
              <button
                onClick={() => setActiveTab("trade")}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === "trade"
                    ? "text-white border-b-2 border-blue-500"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                İşlem
                {trades.filter((t) => t.status === "open").length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
                    {trades.filter((t) => t.status === "open").length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("stats")}
                className={`flex-1 py-2.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === "stats"
                    ? "text-white border-b-2 border-blue-500"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                İstatistik
              </button>
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-hidden min-h-0">
              {activeTab === "trade" ? (
                <TradePanel
                  currentPrice={currentPrice}
                  onTradeOpened={() => setActiveTab("trade")}
                />
              ) : (
                <StatsPanel />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
