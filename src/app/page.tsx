"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AUTH_KEY, APP_PASSWORD } from "@/lib/constants";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(AUTH_KEY) === "1") {
      router.replace("/dashboard");
    }
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      if (password === APP_PASSWORD) {
        sessionStorage.setItem(AUTH_KEY, "1");
        router.replace("/dashboard");
      } else {
        setError("Hatalı şifre. Tekrar dene.");
        setIsLoading(false);
      }
    }, 400);
  };

  return (
    <div className="h-full flex items-center justify-center bg-[#0d0d0d]">
      {/* Background grid */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-96 h-96 bg-blue-600 rounded-full blur-[160px] opacity-10" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        {/* Logo / Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-600/20 mb-4">
            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 3v18h18M7 16l4-4 4 4 4-8" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">XAU Backtest Pro</h1>
          <p className="text-sm text-gray-500">Profesyonel forex backtest sistemi</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-6 space-y-4"
            style={{ backdropFilter: "blur(8px)" }}
          >
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">
                Şifre
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="••••••••••"
                autoFocus
                className="w-full px-4 py-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-colors text-sm"
              />
              {error && (
                <p className="mt-2 text-xs text-red-400">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Giriş yapılıyor...
                </>
              ) : (
                "Giriş Yap"
              )}
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-gray-600 mt-6">
          XAU/USD • Forex Backtesting System
        </p>
      </div>
    </div>
  );
}
