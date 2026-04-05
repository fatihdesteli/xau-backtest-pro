"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBacktestStore } from "@/lib/store";
import { AUTH_KEY, TIMEFRAMES, TIMEFRAME_CONFIG, INSTRUMENT_CONFIG } from "@/lib/constants";
import type { Timeframe } from "@/lib/types";
import SettingsModal from "./SettingsModal";
import SessionModal from "./SessionModal";

interface Props {
  onTimeframeChange: (tf: Timeframe) => void;
  currentTimeframe: Timeframe;
}

export default function TopBar({ onTimeframeChange, currentTimeframe }: Props) {
  const router = useRouter();
  const session = useBacktestStore((s) => s.session);
  const trades = useBacktestStore((s) => s.trades);
  const settings = useBacktestStore((s) => s.settings);
  const getStats = useBacktestStore((s) => s.getStats);
  const firebaseEnabled = useBacktestStore((s) => s.firebaseEnabled);

  const [showSettings, setShowSettings] = useState(false);
  const [showSession, setShowSession] = useState(false);

  const stats = getStats();
  const instrument = session?.instrument ?? "XAUUSD";
  const cfg = INSTRUMENT_CONFIG[instrument];

  const handleLogout = () => {
    sessionStorage.removeItem(AUTH_KEY);
    router.replace("/");
  };

  return (
    <>
      <div className="flex items-center gap-3 px-3 py-2 bg-[#111] border-b border-[#1e2028] select-none shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded bg-blue-600/20 border border-blue-600/30 flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M3 3v18h18M7 16l4-4 4 4 4-8" />
            </svg>
          </div>
          <span className="text-sm font-bold text-white hidden md:block">BacktestPro</span>
        </div>

        {/* Instrument badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-yellow-500/10 border border-yellow-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-sm font-bold text-yellow-300">{cfg.label}</span>
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-0.5 bg-[#0d0d0d] rounded p-0.5 border border-[#1e2028]">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => onTimeframeChange(tf)}
              className={`
                px-2.5 py-1 text-xs rounded font-medium transition-all
                ${currentTimeframe === tf
                  ? "bg-blue-600 text-white shadow"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                }
              `}
            >
              {TIMEFRAME_CONFIG[tf].label}
            </button>
          ))}
        </div>

        {/* Session name */}
        {session && (
          <button
            onClick={() => setShowSession(true)}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded hover:bg-white/5 transition-colors"
          >
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="text-xs text-gray-400 max-w-[120px] truncate">{session.name}</span>
          </button>
        )}

        {/* Quick stats in header */}
        {stats.totalTrades > 0 && (
          <div className="hidden xl:flex items-center gap-3 ml-2 text-xs font-mono">
            <span className={`font-semibold ${stats.totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
              {stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toFixed(0)}
            </span>
            <span className="text-gray-600">|</span>
            <span className={`${stats.winRate >= 50 ? "text-green-400" : "text-red-400"}`}>
              WR {stats.winRate.toFixed(0)}%
            </span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400">{stats.totalTrades} işlem</span>
          </div>
        )}

        {/* Right side actions */}
        <div className="ml-auto flex items-center gap-1">
          {/* Firebase status */}
          <div
            className={`w-2 h-2 rounded-full ${firebaseEnabled ? "bg-green-500" : "bg-gray-600"}`}
            title={firebaseEnabled ? "Firebase bağlı" : "Firebase bağlı değil (yerel kayıt)"}
          />

          {/* Session manager */}
          <button
            onClick={() => setShowSession(true)}
            className="btn btn-ghost text-xs px-2"
            title="Oturumlar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </button>

          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            className="btn btn-ghost text-xs px-2"
            title="Ayarlar"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="btn btn-ghost text-xs px-2 text-gray-600 hover:text-red-400"
            title="Çıkış"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      {/* Modals */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showSession && <SessionModal onClose={() => setShowSession(false)} />}
    </>
  );
}
