"use client";

import { useState } from "react";
import { useBacktestStore } from "@/lib/store";
import type { Trade } from "@/lib/types";

function fmtPnl(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

function CloseReasonBadge({ reason }: { reason: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    manual: { label: "Manuel", cls: "bg-blue-600/20 text-blue-400" },
    tp:     { label: "TP",     cls: "bg-green-600/20 text-green-400" },
    sl:     { label: "SL",     cls: "bg-red-600/20 text-red-400" },
    time:   { label: "Zaman",  cls: "bg-yellow-600/20 text-yellow-400" },
  };
  const cfg = reason ? map[reason] : null;
  if (!cfg) return null;
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

export default function StatsPanel() {
  const getStats = useBacktestStore((s) => s.getStats);
  const trades = useBacktestStore((s) => s.trades);
  const deleteTrade = useBacktestStore((s) => s.deleteTrade);
  const session = useBacktestStore((s) => s.session);
  const settings = useBacktestStore((s) => s.settings);

  const [tab, setTab] = useState<"stats" | "history">("stats");
  const [noteExpanded, setNoteExpanded] = useState<string | null>(null);

  const stats = getStats();
  const closedTrades = trades.filter((t) => t.status === "closed")
    .sort((a, b) => (b.exitTime ?? 0) - (a.exitTime ?? 0));

  const accountGrowth = stats.totalPnl
    ? ((stats.totalPnl / settings.accountSize) * 100)
    : 0;

  const StatItem = ({ label, value, sub, color }: {
    label: string; value: string; sub?: string; color?: string;
  }) => (
    <div className="stat-card">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-base font-bold font-mono ${color ?? "text-white"}`}>{value}</div>
      {sub && <div className="text-xs text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-[#1e2028]">
        {(["stats", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              tab === t
                ? "text-white border-b-2 border-blue-500"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t === "stats" ? "İstatistikler" : `Geçmiş (${closedTrades.length})`}
          </button>
        ))}
      </div>

      {/* Stats tab */}
      {tab === "stats" && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-2">
            <StatItem
              label="Toplam P&L"
              value={fmtPnl(stats.totalPnl)}
              sub={`${fmtPct(accountGrowth)} hesap`}
              color={stats.totalPnl >= 0 ? "text-green-400" : "text-red-400"}
            />
            <StatItem
              label="Win Rate"
              value={fmtPct(stats.winRate)}
              sub={`${stats.winners}W / ${stats.losers}L`}
              color={stats.winRate >= 50 ? "text-green-400" : "text-red-400"}
            />
            <StatItem
              label="Profit Factor"
              value={stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)}
              color={stats.profitFactor >= 1.5 ? "text-green-400" : stats.profitFactor >= 1 ? "text-yellow-400" : "text-red-400"}
            />
            <StatItem
              label="Ort. R Katsayısı"
              value={`${stats.avgRMultiple > 0 ? "+" : ""}${stats.avgRMultiple.toFixed(2)}R`}
              color={stats.avgRMultiple >= 0 ? "text-green-400" : "text-red-400"}
            />
          </div>

          {/* Trade counts */}
          <div className="grid grid-cols-3 gap-2">
            <StatItem label="Toplam" value={String(stats.totalTrades)} sub="kapanan" />
            <StatItem label="Long" value={String(stats.longsCount)} />
            <StatItem label="Short" value={String(stats.shortsCount)} />
          </div>

          {/* Avg win/loss */}
          <div className="grid grid-cols-2 gap-2">
            <StatItem
              label="Ort. Kazanç"
              value={fmtPnl(stats.avgWin)}
              color="text-green-400"
            />
            <StatItem
              label="Ort. Kayıp"
              value={fmtPnl(-stats.avgLoss)}
              color="text-red-400"
            />
          </div>

          {/* Best/worst */}
          <div className="grid grid-cols-2 gap-2">
            <StatItem
              label="En İyi İşlem"
              value={fmtPnl(stats.bestTrade)}
              color="text-green-400"
            />
            <StatItem
              label="En Kötü İşlem"
              value={fmtPnl(stats.worstTrade)}
              color="text-red-400"
            />
          </div>

          {/* Max drawdown */}
          <StatItem
            label="Maks. Drawdown"
            value={`-$${stats.maxDrawdown.toFixed(2)}`}
            sub={`${stats.totalPnl > 0 ? fmtPct((stats.maxDrawdown / settings.accountSize) * 100) : "—"} hesap`}
            color="text-red-400"
          />

          {/* Equity curve simple viz */}
          {closedTrades.length > 1 && (
            <div className="stat-card">
              <div className="text-xs text-gray-500 mb-2">Equity Eğrisi</div>
              <EquityCurve trades={closedTrades} />
            </div>
          )}

          {/* Win/loss by direction */}
          {stats.totalTrades > 0 && (
            <div className="stat-card space-y-1.5">
              <div className="text-xs text-gray-500 mb-2">Yön Dağılımı</div>
              <div className="flex items-center gap-2">
                <div className="w-16 text-xs text-gray-400">Long</div>
                <div className="flex-1 bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${stats.totalTrades > 0 ? (stats.longsCount / stats.totalTrades) * 100 : 0}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 w-8 text-right">{stats.longsCount}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-16 text-xs text-gray-400">Short</div>
                <div className="flex-1 bg-gray-800 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full"
                    style={{ width: `${stats.totalTrades > 0 ? (stats.shortsCount / stats.totalTrades) * 100 : 0}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 w-8 text-right">{stats.shortsCount}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {tab === "history" && (
        <div className="flex-1 overflow-y-auto">
          {closedTrades.length === 0 ? (
            <div className="flex items-center justify-center h-24 text-gray-600 text-xs">
              Henüz kapanan işlem yok
            </div>
          ) : (
            <div className="divide-y divide-[#1a1a1a]">
              {closedTrades.map((trade, i) => {
                const pnl = trade.pnl ?? 0;
                const isWin = pnl > 0;
                const entryDate = new Date(trade.entryTime * 1000);
                const exitDate = trade.exitTime ? new Date(trade.exitTime * 1000) : null;

                return (
                  <div key={trade.id} className="p-2.5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      {/* Trade number */}
                      <span className="text-xs text-gray-600 w-5 text-right">#{closedTrades.length - i}</span>

                      {/* Direction */}
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                        trade.direction === "long"
                          ? "bg-green-600/20 text-green-400"
                          : "bg-red-600/20 text-red-400"
                      }`}>
                        {trade.direction === "long" ? "L" : "S"}
                      </span>

                      {/* Close reason */}
                      <CloseReasonBadge reason={trade.closeReason} />

                      {/* P&L */}
                      <span className={`ml-auto text-sm font-bold font-mono ${isWin ? "text-green-400" : "text-red-400"}`}>
                        {fmtPnl(pnl)}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-gray-500 font-mono ml-7">
                      <span>G: {trade.entryPrice.toFixed(2)}</span>
                      <span>→</span>
                      <span>{trade.exitPrice?.toFixed(2) ?? "—"}</span>
                      <span className="ml-auto">{trade.lotSize}L</span>
                      {trade.rMultiple !== null && (
                        <span className={trade.rMultiple >= 0 ? "text-green-600" : "text-red-600"}>
                          {trade.rMultiple > 0 ? "+" : ""}{trade.rMultiple.toFixed(2)}R
                        </span>
                      )}
                    </div>

                    {/* Notes */}
                    {trade.notes && (
                      <div className="mt-1 ml-7 text-xs text-gray-600 italic truncate">
                        {trade.notes}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Simple equity curve using SVG
function EquityCurve({ trades }: { trades: Trade[] }) {
  const sorted = [...trades].sort((a, b) => (a.exitTime ?? 0) - (b.exitTime ?? 0));
  let running = 0;
  const points = sorted.map((t) => {
    running += t.pnl ?? 0;
    return running;
  });

  if (points.length < 2) return null;

  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const range = max - min || 1;
  const W = 200;
  const H = 48;

  const toX = (i: number) => (i / (points.length - 1)) * W;
  const toY = (v: number) => H - ((v - min) / range) * H;

  const pathD = points.map((v, i) =>
    `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`
  ).join(" ");

  const zeroY = toY(0);
  const isFinal = points[points.length - 1];
  const isPositive = isFinal >= 0;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {/* Zero line */}
      {zeroY > 0 && zeroY < H && (
        <line x1={0} y1={zeroY} x2={W} y2={zeroY} stroke="#2a2a2a" strokeWidth={1} strokeDasharray="3,3" />
      )}
      {/* Curve */}
      <path d={pathD} fill="none" stroke={isPositive ? "#22c55e" : "#ef4444"} strokeWidth={1.5} />
      {/* Fill under curve */}
      <path
        d={`${pathD} L ${toX(points.length - 1).toFixed(1)} ${H} L 0 ${H} Z`}
        fill={isPositive ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)"}
      />
    </svg>
  );
}
