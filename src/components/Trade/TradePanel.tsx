"use client";

import { useState, useCallback } from "react";
import { useBacktestStore } from "@/lib/store";
import { calcLotFromRisk, INSTRUMENT_CONFIG } from "@/lib/constants";
import type { TradeDirection } from "@/lib/types";

interface Props {
  currentPrice: number | null;
  onTradeOpened?: () => void;
}

export default function TradePanel({ currentPrice, onTradeOpened }: Props) {
  const session = useBacktestStore((s) => s.session);
  const settings = useBacktestStore((s) => s.settings);
  const candles = useBacktestStore((s) => s.candles);
  const currentBarIndex = useBacktestStore((s) => s.currentBarIndex);
  const openTrade = useBacktestStore((s) => s.openTrade);
  const closeTrade = useBacktestStore((s) => s.closeTrade);
  const updateTradeLevel = useBacktestStore((s) => s.updateTradeLevel);
  const updateTradeNotes = useBacktestStore((s) => s.updateTradeNotes);
  const deleteTrade = useBacktestStore((s) => s.deleteTrade);
  const trades = useBacktestStore((s) => s.trades);

  const openTrades = trades.filter((t) => t.status === "open");
  const candle = candles[currentBarIndex];
  const entryPrice = currentPrice ?? candle?.close ?? 0;

  const [direction, setDirection] = useState<TradeDirection>("long");
  const [lotSize, setLotSize] = useState(settings.defaultLotSize);
  const [useRisk, setUseRisk] = useState(false);
  const [slInput, setSlInput] = useState("");
  const [tpInput, setTpInput] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const instrument = session?.instrument ?? "XAUUSD";
  const cfg = INSTRUMENT_CONFIG[instrument];

  // Calc lot from risk
  const sl = parseFloat(slInput);
  const tp = parseFloat(tpInput);

  const calcedLot = useRisk && !isNaN(sl) && sl > 0
    ? calcLotFromRisk(settings.accountSize, settings.riskPerTrade, entryPrice, sl, instrument)
    : lotSize;

  // P&L preview
  const previewPnl = (price: number, lot: number) => {
    const diff = direction === "long" ? price - entryPrice : entryPrice - price;
    return diff * lot * 100;
  };

  const handleOpen = () => {
    if (!candle) return;
    openTrade({
      direction,
      entryPrice,
      lotSize: calcedLot,
      stopLoss: !isNaN(sl) && sl > 0 ? sl : undefined,
      takeProfit: !isNaN(tp) && tp > 0 ? tp : undefined,
    });
    onTradeOpened?.();
  };

  const fmt = (v: number) => v.toFixed(cfg.digits);
  const fmtPnl = (v: number) => {
    const sign = v >= 0 ? "+" : "";
    return `${sign}$${v.toFixed(2)}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Open Trade Form ── */}
      <div className="p-3 border-b border-[#1e2028] space-y-3">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Yeni İşlem
        </div>

        {/* Direction buttons */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setDirection("long")}
            className={`py-2 rounded font-semibold text-sm transition-all ${
              direction === "long"
                ? "bg-green-600 text-white shadow-lg shadow-green-900/20"
                : "bg-green-600/10 text-green-400 hover:bg-green-600/20"
            }`}
          >
            ▲ Long
          </button>
          <button
            onClick={() => setDirection("short")}
            className={`py-2 rounded font-semibold text-sm transition-all ${
              direction === "short"
                ? "bg-red-600 text-white shadow-lg shadow-red-900/20"
                : "bg-red-600/10 text-red-400 hover:bg-red-600/20"
            }`}
          >
            ▼ Short
          </button>
        </div>

        {/* Entry price (display only) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500">Giriş Fiyatı</label>
            <span className="text-xs text-blue-400">Market</span>
          </div>
          <div className="px-3 py-2 rounded bg-[#0d0d0d] border border-[#1e2028] text-sm text-white font-mono">
            {fmt(entryPrice)}
          </div>
        </div>

        {/* Lot size + risk toggle */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500">Lot / Risk</label>
            <button
              onClick={() => setUseRisk((v) => !v)}
              className={`text-xs px-2 py-0.5 rounded transition-colors ${
                useRisk ? "bg-blue-600/20 text-blue-400" : "text-gray-600 hover:text-gray-400"
              }`}
            >
              {useRisk ? `${settings.riskPerTrade}% Risk` : "Manuel Lot"}
            </button>
          </div>
          {useRisk ? (
            <div className="px-3 py-2 rounded bg-[#0d0d0d] border border-blue-600/30 text-sm text-blue-300 font-mono">
              {calcedLot} lot
              <span className="text-xs text-gray-500 ml-2">
                (${(settings.accountSize * settings.riskPerTrade / 100).toFixed(0)} risk)
              </span>
            </div>
          ) : (
            <input
              type="number"
              value={lotSize}
              onChange={(e) => setLotSize(Math.max(0.01, parseFloat(e.target.value) || 0.01))}
              step={0.01}
              min={0.01}
              className="w-full px-3 py-2 rounded bg-[#0d0d0d] border border-[#1e2028] text-sm text-white font-mono focus:border-blue-500 focus:outline-none"
            />
          )}
        </div>

        {/* SL */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500">Stop Loss</label>
            {!isNaN(sl) && sl > 0 && (
              <span className="text-xs text-red-400 font-mono">
                {fmtPnl(previewPnl(sl, calcedLot))}
              </span>
            )}
          </div>
          <input
            type="number"
            value={slInput}
            onChange={(e) => setSlInput(e.target.value)}
            placeholder={fmt(direction === "long" ? entryPrice * 0.995 : entryPrice * 1.005)}
            step={0.01}
            className="w-full px-3 py-2 rounded bg-[#0d0d0d] border border-red-900/40 text-sm text-white font-mono focus:border-red-500 focus:outline-none placeholder-gray-700"
          />
        </div>

        {/* TP */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-500">Take Profit</label>
            {!isNaN(tp) && tp > 0 && (
              <span className="text-xs text-green-400 font-mono">
                {fmtPnl(previewPnl(tp, calcedLot))}
              </span>
            )}
          </div>
          <input
            type="number"
            value={tpInput}
            onChange={(e) => setTpInput(e.target.value)}
            placeholder={fmt(direction === "long" ? entryPrice * 1.01 : entryPrice * 0.99)}
            step={0.01}
            className="w-full px-3 py-2 rounded bg-[#0d0d0d] border border-green-900/40 text-sm text-white font-mono focus:border-green-500 focus:outline-none placeholder-gray-700"
          />
        </div>

        {/* R:R ratio preview */}
        {!isNaN(sl) && sl > 0 && !isNaN(tp) && tp > 0 && (
          <div className="px-3 py-2 rounded bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-between">
            <span className="text-xs text-gray-500">Risk:Reward</span>
            <span className="text-xs font-mono text-yellow-400">
              1 : {(Math.abs(previewPnl(tp, calcedLot)) / Math.abs(previewPnl(sl, calcedLot))).toFixed(2)}
            </span>
          </div>
        )}

        {/* Open button */}
        <button
          onClick={handleOpen}
          disabled={!candle}
          className={`
            w-full py-2.5 rounded font-semibold text-sm transition-all
            disabled:opacity-40 disabled:cursor-not-allowed
            ${direction === "long"
              ? "bg-green-600 hover:bg-green-500 text-white"
              : "bg-red-600 hover:bg-red-500 text-white"
            }
          `}
        >
          {direction === "long" ? "▲ Long Aç" : "▼ Short Aç"}
        </button>
      </div>

      {/* ── Open Trades ── */}
      <div className="flex-1 overflow-y-auto">
        {openTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-24 text-gray-600 text-xs">
            <svg className="w-6 h-6 mb-1 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Açık işlem yok
          </div>
        ) : (
          <div className="space-y-0.5 p-2">
            {openTrades.map((trade) => {
              const unrealizedPnl = candle
                ? (trade.direction === "long"
                    ? (candle.close - trade.entryPrice) * trade.lotSize * 100
                    : (trade.entryPrice - candle.close) * trade.lotSize * 100)
                : 0;
              const isProfit = unrealizedPnl >= 0;
              const isExpanded = expandedId === trade.id;

              return (
                <div
                  key={trade.id}
                  className="rounded-lg border border-[#1e2028] overflow-hidden"
                >
                  {/* Trade header */}
                  <div
                    className="flex items-center gap-2 p-2.5 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : trade.id)}
                  >
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                      trade.direction === "long"
                        ? "bg-green-600/20 text-green-400"
                        : "bg-red-600/20 text-red-400"
                    }`}>
                      {trade.direction === "long" ? "L" : "S"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400 font-mono">{fmt(trade.entryPrice)}</span>
                        <span className={`text-xs font-mono font-semibold ${isProfit ? "text-green-400" : "text-red-400"}`}>
                          {fmtPnl(unrealizedPnl)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs text-gray-600">{trade.lotSize} lot</span>
                        <span className="text-xs text-gray-600">{trade.timeframe}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded panel */}
                  {isExpanded && (
                    <div className="border-t border-[#1e2028] p-2.5 space-y-2 bg-[#0d0d0d]">
                      {/* TP/SL editors */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-green-600 block mb-1">Take Profit</label>
                          <input
                            type="number"
                            defaultValue={trade.takeProfit ?? ""}
                            onBlur={(e) => updateTradeLevel(trade.id, "takeProfit",
                              e.target.value ? parseFloat(e.target.value) : null)}
                            step={0.01}
                            placeholder="—"
                            className="w-full px-2 py-1.5 rounded bg-[#141414] border border-green-900/30 text-xs text-white font-mono focus:border-green-500 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-red-600 block mb-1">Stop Loss</label>
                          <input
                            type="number"
                            defaultValue={trade.stopLoss ?? ""}
                            onBlur={(e) => updateTradeLevel(trade.id, "stopLoss",
                              e.target.value ? parseFloat(e.target.value) : null)}
                            step={0.01}
                            placeholder="—"
                            className="w-full px-2 py-1.5 rounded bg-[#141414] border border-red-900/30 text-xs text-white font-mono focus:border-red-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      {/* Notes */}
                      <textarea
                        defaultValue={trade.notes}
                        onBlur={(e) => updateTradeNotes(trade.id, e.target.value)}
                        placeholder="Not ekle..."
                        rows={2}
                        className="w-full px-2 py-1.5 rounded bg-[#141414] border border-[#2a2a2a] text-xs text-gray-300 resize-none focus:border-gray-600 focus:outline-none placeholder-gray-700"
                      />

                      {/* Levels info */}
                      {(trade.stopLoss || trade.takeProfit) && (
                        <div className="grid grid-cols-2 gap-1 text-xs font-mono">
                          {trade.stopLoss && (
                            <div className="flex items-center justify-between px-2 py-1 rounded bg-red-900/10">
                              <span className="text-red-600">SL</span>
                              <span className="text-red-400">{fmtPnl(calcTradePnl(trade.stopLoss, trade.lotSize, trade.direction, trade.entryPrice))}</span>
                            </div>
                          )}
                          {trade.takeProfit && (
                            <div className="flex items-center justify-between px-2 py-1 rounded bg-green-900/10">
                              <span className="text-green-600">TP</span>
                              <span className="text-green-400">{fmtPnl(calcTradePnl(trade.takeProfit, trade.lotSize, trade.direction, trade.entryPrice))}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => closeTrade(trade.id, entryPrice, "manual")}
                          className="flex-1 py-1.5 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs font-medium transition-colors"
                        >
                          Market Kapat
                        </button>
                        {trade.takeProfit && (
                          <button
                            onClick={() => closeTrade(trade.id, trade.takeProfit!, "tp")}
                            className="flex-1 py-1.5 rounded bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs font-medium transition-colors"
                          >
                            TP'den Kapat
                          </button>
                        )}
                        {trade.stopLoss && (
                          <button
                            onClick={() => closeTrade(trade.id, trade.stopLoss!, "sl")}
                            className="flex-1 py-1.5 rounded bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-medium transition-colors"
                          >
                            SL'den Kapat
                          </button>
                        )}
                        <button
                          onClick={() => { deleteTrade(trade.id); setExpandedId(null); }}
                          className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-500 hover:text-red-400 transition-colors"
                          title="Sil"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper (outside component to avoid closure issues)
function calcTradePnl(price: number, lotSize: number, direction: string, entryPrice: number): number {
  const diff = direction === "long" ? price - entryPrice : entryPrice - price;
  return diff * lotSize * 100;
}
