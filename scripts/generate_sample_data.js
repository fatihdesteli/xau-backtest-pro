#!/usr/bin/env node
/**
 * Generates realistic XAUUSD-like candlestick data.
 * Candles look like real gold charts: small bodies, proportional wicks,
 * occasional rejection/spike candles, proper trending structure.
 */

const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "../public/data");

function generateCandles(count, intervalSeconds, startTime, startPrice = 2050, volBase = 0.0006) {
  const candles = [];
  let price = startPrice;
  let time = startTime;

  let trendBias = 0;
  let trendLen = 0;
  let trendCount = 0;

  // Slow drift component (longer cycles)
  let driftAngle = 0;

  for (let i = 0; i < count; i++) {
    // Change trend direction periodically
    if (trendCount <= 0) {
      trendBias = (Math.random() - 0.5) * 0.0003;
      trendLen = 15 + Math.floor(Math.random() * 60);
      trendCount = trendLen;
    }
    trendCount--;

    // Slow drift (sinusoidal)
    driftAngle += 0.005 + Math.random() * 0.003;
    const drift = Math.sin(driftAngle) * price * 0.00005;

    const vol = price * volBase;

    // Body: small-medium size, biased by trend
    const bodyFactor = 0.3 + Math.random() * 0.7; // 30-100% of vol
    const bodyDir = Math.random() < (0.5 + trendBias * 500) ? 1 : -1;
    const bodySize = bodyFactor * vol * bodyDir + drift;

    const open = price;
    const close = price + bodySize;

    // Wicks: proportional to body with small baseline
    const bodyRange = Math.abs(close - open);
    const wickBase = vol * 0.08; // small baseline wick

    // Upper wick: short on bullish candles, longer on bearish (rejection)
    const upperWick = wickBase + bodyRange * (0.05 + Math.random() * 0.25);
    // Lower wick: short on bearish candles, longer on bullish
    const lowerWick = wickBase + bodyRange * (0.05 + Math.random() * 0.25);

    // Occasional spike/rejection candle (3% chance)
    const isSpiked = Math.random() < 0.03;
    const spikeMultiplier = isSpiked ? (2 + Math.random() * 3) : 1;

    const high = Math.max(open, close) + upperWick * spikeMultiplier;
    const low = Math.min(open, close) - lowerWick * spikeMultiplier;

    // Volume: higher on bigger moves
    const moveSize = Math.abs(bodySize) / vol;
    const volume = Math.floor(800 + moveSize * 3000 + Math.random() * 2000);

    candles.push({
      time,
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      volume,
    });

    price = close;

    // Soft price boundary (not hard reset)
    if (price < 1850) { trendBias = Math.abs(trendBias) + 0.0002; }
    if (price > 2550) { trendBias = -Math.abs(trendBias) - 0.0002; }

    time += intervalSeconds;
  }

  return candles;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

// ─── Timeframe configs ───────────────────────────────────────────────────────
const now = Math.floor(Date.now() / 1000);

const TIMEFRAMES = [
  { key: "1m",  file: "xauusd_1m.json",  interval: 60,    count: 10080, vol: 0.00018 },
  { key: "5m",  file: "xauusd_5m.json",  interval: 300,   count: 8640,  vol: 0.00032 },
  { key: "15m", file: "xauusd_15m.json", interval: 900,   count: 5760,  vol: 0.00048 },
  { key: "1h",  file: "xauusd_1h.json",  interval: 3600,  count: 4380,  vol: 0.00085 },
  { key: "4h",  file: "xauusd_4h.json",  interval: 14400, count: 2000,  vol: 0.0015  },
  { key: "1D",  file: "xauusd_1d.json",  interval: 86400, count: 1000,  vol: 0.0022  },
];

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
console.log("🔸 Generating XAUUSD candle data...\n");

// Use shared price so timeframes are consistent (roughly)
let basePrice = 2200;

TIMEFRAMES.forEach(({ key, file, interval, count, vol }) => {
  const startTime = now - count * interval;
  const candles = generateCandles(count, interval, startTime, basePrice, vol);
  basePrice = candles[candles.length - 1].close;

  const outPath = path.join(OUTPUT_DIR, file);
  fs.writeFileSync(outPath, JSON.stringify(candles));

  const sizeKb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`  ✓ ${key.padEnd(4)} — ${count} candles → ${file} (${sizeKb} KB)`);
});

fs.writeFileSync(
  path.join(OUTPUT_DIR, "manifest.json"),
  JSON.stringify({
    symbol: "XAUUSD",
    source: "Sample data — run python scripts/download_data.py for real data",
    generated_at: new Date().toISOString(),
  }, null, 2)
);

console.log("\n✅ Done!\n");
