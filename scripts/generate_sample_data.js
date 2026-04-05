#!/usr/bin/env node
/**
 * Generates realistic XAUUSD sample data for all timeframes.
 * Simulates price around 2000-2400 range with realistic volatility.
 *
 * Run: node scripts/generate_sample_data.js
 */

const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "../public/data");

// ─── Realistic XAUUSD random walk ─────────────────────────────────────────────
function generateCandles(
  count,
  intervalSeconds,
  startTime,
  startPrice = 2050,
  volatilityPct = 0.0008
) {
  const candles = [];
  let price = startPrice;
  let time = startTime;

  // Trending component
  let trendBias = 0;
  let trendTimer = 0;

  for (let i = 0; i < count; i++) {
    // Update trend every N candles
    if (trendTimer <= 0) {
      trendBias = (Math.random() - 0.48) * 0.0002;
      trendTimer = 10 + Math.floor(Math.random() * 40);
    }
    trendTimer--;

    const vol = price * volatilityPct;
    const body = (Math.random() - 0.5 + trendBias) * vol * 2;
    const open = price;
    const close = price + body;
    const wick = vol * (0.5 + Math.random() * 1.5);

    const high = Math.max(open, close) + Math.abs(Math.random() * wick);
    const low = Math.min(open, close) - Math.abs(Math.random() * wick);

    candles.push({
      time,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume: Math.floor(1000 + Math.random() * 9000),
    });

    price = close;
    // Keep price in realistic range
    if (price < 1800) price = 1800 + Math.random() * 50;
    if (price > 2600) price = 2600 - Math.random() * 50;

    time += intervalSeconds;
  }

  return candles;
}

// ─── Config ───────────────────────────────────────────────────────────────────
const now = Math.floor(Date.now() / 1000);
const tradingHourSeconds = 3600;

const TIMEFRAMES = [
  { key: "1m",  file: "xauusd_1m.json",  interval: 60,    count: 10080, volatility: 0.00025 },
  { key: "5m",  file: "xauusd_5m.json",  interval: 300,   count: 8640,  volatility: 0.0004  },
  { key: "15m", file: "xauusd_15m.json", interval: 900,   count: 5760,  volatility: 0.0006  },
  { key: "1h",  file: "xauusd_1h.json",  interval: 3600,  count: 4380,  volatility: 0.001   },
  { key: "4h",  file: "xauusd_4h.json",  interval: 14400, count: 2000,  volatility: 0.0018  },
  { key: "1D",  file: "xauusd_1d.json",  interval: 86400, count: 1000,  volatility: 0.0025  },
];

// ─── Generate & Save ──────────────────────────────────────────────────────────
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

console.log("🔸 Generating XAUUSD sample data...\n");

let basePrice = 2050;

TIMEFRAMES.forEach(({ key, file, interval, count, volatility }) => {
  const startTime = now - count * interval;
  const candles = generateCandles(count, interval, startTime, basePrice, volatility);

  // Keep price continuity across timeframes (roughly)
  basePrice = candles[candles.length - 1].close;

  const outPath = path.join(OUTPUT_DIR, file);
  fs.writeFileSync(outPath, JSON.stringify(candles));

  const sizeKb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`  ✓ ${key.padEnd(4)} — ${count} candles → ${file} (${sizeKb} KB)`);
});

// Manifest
const manifest = {
  symbol: "XAUUSD",
  source: "Generated sample data (replace with real data via scripts/download_data.py)",
  generated_at: new Date().toISOString(),
  note: "Run 'python scripts/download_data.py' to replace with real Yahoo Finance data",
};
fs.writeFileSync(path.join(OUTPUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log("\n✅ Sample data generated!");
console.log("   Run 'python scripts/download_data.py' for real historical data.\n");
