"use client";

import { useState } from "react";
import { useBacktestStore } from "@/lib/store";
import { isFirebaseConfigured } from "@/lib/firebase";

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  const settings = useBacktestStore((s) => s.settings);
  const updateSettings = useBacktestStore((s) => s.updateSettings);
  const firebaseEnabled = useBacktestStore((s) => s.firebaseEnabled);
  const setFirebaseEnabled = useBacktestStore((s) => s.setFirebaseEnabled);
  const syncToFirebase = useBacktestStore((s) => s.syncToFirebase);

  const [local, setLocal] = useState({ ...settings });
  const [syncing, setSyncing] = useState(false);
  const fbConfigured = isFirebaseConfigured();

  const save = () => {
    updateSettings(local);
    onClose();
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncToFirebase();
      alert("Veriler Firebase'e aktarıldı!");
    } catch (e) {
      alert("Senkronizasyon hatası: " + e);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#141414] border border-[#1e2028] rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2028]">
          <h2 className="text-sm font-semibold text-white">Ayarlar</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Account */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Hesap Ayarları
            </h3>
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-gray-500 block mb-1">Hesap Bakiyesi ($)</span>
                <input
                  type="number"
                  value={local.accountSize}
                  onChange={(e) => setLocal({ ...local, accountSize: parseFloat(e.target.value) || 10000 })}
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0d0d] border border-[#2a2a2a] text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500 block mb-1">Varsayılan Lot</span>
                <input
                  type="number"
                  value={local.defaultLotSize}
                  onChange={(e) => setLocal({ ...local, defaultLotSize: parseFloat(e.target.value) || 0.1 })}
                  step={0.01}
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0d0d] border border-[#2a2a2a] text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500 block mb-1">İşlem Başı Risk (%)</span>
                <input
                  type="number"
                  value={local.riskPerTrade}
                  onChange={(e) => setLocal({ ...local, riskPerTrade: parseFloat(e.target.value) || 1 })}
                  step={0.1}
                  min={0.1}
                  max={10}
                  className="w-full px-3 py-2 rounded-lg bg-[#0d0d0d] border border-[#2a2a2a] text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </label>
            </div>
          </section>

          {/* Replay */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Replay Ayarları
            </h3>
            <label className="block">
              <span className="text-xs text-gray-500 block mb-1">Varsayılan Hız (bar/sn)</span>
              <input
                type="number"
                value={local.autoPlaySpeed}
                onChange={(e) => setLocal({ ...local, autoPlaySpeed: parseFloat(e.target.value) || 2 })}
                step={0.5}
                min={0.5}
                max={30}
                className="w-full px-3 py-2 rounded-lg bg-[#0d0d0d] border border-[#2a2a2a] text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </label>
          </section>

          {/* Firebase */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Firebase Senkronizasyon
            </h3>
            {!fbConfigured ? (
              <div className="p-3 rounded-lg bg-yellow-600/10 border border-yellow-600/20 text-xs text-yellow-400 space-y-1">
                <p className="font-medium">Firebase yapılandırılmamış</p>
                <p className="text-yellow-600">
                  .env.local dosyasına Firebase config bilgilerini ekleyin.
                  Kurulum için README.md dosyasına bakın.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setFirebaseEnabled(!firebaseEnabled)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      firebaseEnabled ? "bg-blue-600" : "bg-gray-700"
                    }`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      firebaseEnabled ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </div>
                  <span className="text-sm text-gray-300">Firebase senkronizasyonu</span>
                </label>
                {firebaseEnabled && (
                  <button
                    onClick={handleSync}
                    disabled={syncing}
                    className="w-full py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-sm transition-colors disabled:opacity-50"
                  >
                    {syncing ? "Senkronize ediliyor..." : "Şimdi Senkronize Et"}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Keyboard shortcuts */}
          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Klavye Kısayolları
            </h3>
            <div className="space-y-1.5 text-xs">
              {[
                ["→", "1 bar ileri"],
                ["←", "1 bar geri"],
                ["Shift + →", "10 bar ileri"],
                ["Shift + ←", "10 bar geri"],
                ["Space", "Oynat / Duraklat"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-gray-500">{desc}</span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-300 font-mono">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-4 border-t border-[#1e2028]">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white text-sm transition-colors"
          >
            İptal
          </button>
          <button
            onClick={save}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
