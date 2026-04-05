"use client";

import { useState } from "react";
import { useBacktestStore } from "@/lib/store";
import type { Instrument, Timeframe } from "@/lib/types";

interface Props {
  onClose: () => void;
}

export default function SessionModal({ onClose }: Props) {
  const session = useBacktestStore((s) => s.session);
  const createSession = useBacktestStore((s) => s.createSession);
  const trades = useBacktestStore((s) => s.trades);
  const getStats = useBacktestStore((s) => s.getStats);

  const [tab, setTab] = useState<"new" | "current">("current");
  const [name, setName] = useState(`Oturum ${new Date().toLocaleDateString("tr-TR")}`);
  const [instrument, setInstrument] = useState<Instrument>("XAUUSD");
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");

  const stats = getStats();

  const handleCreate = () => {
    createSession(name, instrument, timeframe);
    onClose();
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString("tr-TR", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#141414] border border-[#1e2028] rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2028]">
          <h2 className="text-sm font-semibold text-white">Oturum Yönetimi</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1e2028]">
          {(["current", "new"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                tab === t ? "text-white border-b-2 border-blue-500 -mb-px" : "text-gray-500"
              }`}
            >
              {t === "current" ? "Mevcut Oturum" : "Yeni Oturum"}
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === "current" && (
            <div className="space-y-4">
              {session ? (
                <>
                  <div className="p-4 rounded-lg bg-[#0d0d0d] border border-[#1e2028] space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-medium text-white">{session.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {formatDate(session.createdAt)}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <span className="px-2 py-0.5 rounded text-xs bg-yellow-600/20 text-yellow-400 font-mono">
                          {session.instrument}
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs bg-blue-600/20 text-blue-400">
                          {session.timeframe}
                        </span>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-[#1e2028]">
                      <div className="text-center">
                        <div className="text-xs text-gray-500">İşlem</div>
                        <div className="text-sm font-mono font-bold text-white">{stats.totalTrades}</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500">Win Rate</div>
                        <div className={`text-sm font-mono font-bold ${stats.winRate >= 50 ? "text-green-400" : "text-red-400"}`}>
                          {stats.winRate.toFixed(0)}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500">P&L</div>
                        <div className={`text-sm font-mono font-bold ${stats.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                          ${stats.totalPnl.toFixed(0)}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600">
                    Mevcut oturumu koruyarak yeni bir oturum başlatmak için "Yeni Oturum" sekmesini kullanın.
                  </p>
                </>
              ) : (
                <div className="text-center py-6 text-gray-600 text-sm">
                  Aktif oturum yok. Yeni bir oturum başlatın.
                </div>
              )}
            </div>
          )}

          {tab === "new" && (
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs text-gray-500 block mb-1.5">Oturum Adı</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0d0d] border border-[#2a2a2a] text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </label>

              <label className="block">
                <span className="text-xs text-gray-500 block mb-1.5">Parite</span>
                <select
                  value={instrument}
                  onChange={(e) => setInstrument(e.target.value as Instrument)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0d0d] border border-[#2a2a2a] text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="XAUUSD">XAU/USD (Altın)</option>
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-gray-500 block mb-1.5">Başlangıç Timeframe</span>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as Timeframe)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0d0d] border border-[#2a2a2a] text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="5m">5 Dakika</option>
                  <option value="15m">15 Dakika</option>
                  <option value="1h">1 Saat</option>
                  <option value="4h">4 Saat</option>
                  <option value="1D">Günlük</option>
                </select>
              </label>

              {trades.length > 0 && (
                <div className="p-3 rounded-lg bg-yellow-600/10 border border-yellow-600/20 text-xs text-yellow-400">
                  ⚠️ Mevcut oturumda {trades.length} işlem var. Yeni oturum başlatırsanız bunlar kaybolabilir.
                </div>
              )}

              <button
                onClick={handleCreate}
                disabled={!name.trim()}
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium transition-colors"
              >
                Oturum Başlat
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
