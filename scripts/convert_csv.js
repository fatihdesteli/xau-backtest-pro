#!/usr/bin/env node
/**
 * Converts MetaTrader CSV → JSON for the backtest system.
 * Format: Date;Open;High;Low;Close;Volume  (semicolon)
 * Date:   YYYY.MM.DD HH:MM
 *
 * Different from-dates per timeframe to keep file sizes reasonable.
 * Run: node scripts/convert_csv.js
 */

const fs   = require("fs");
const path = require("path");

const CSV_DIR = path.join(__dirname, "../../My-Backtest-System");
const OUT_DIR = path.join(__dirname, "../public/data");

const unix = (iso) => new Date(iso).getTime() / 1000;

const FILES = [
  { csv: "xau5min.csv",  out: "xauusd_5m.json",  label: "5m",  from: unix("2023-01-01") },
  { csv: "xau15min.csv", out: "xauusd_15m.json", label: "15m", from: unix("2020-01-01") },
  { csv: "xau30min.csv", out: "xauusd_30m.json", label: "30m", from: unix("2020-01-01") },
  { csv: "xau4h.csv",    out: "xauusd_4h.json",  label: "4h",  from: unix("2020-01-01") },
  { csv: "xau1d.csv",    out: "xauusd_1d.json",  label: "1D",  from: unix("2020-01-01") },
];

function parseDateToUnix(str) {
  const [datePart, timePart = "00:00"] = str.trim().split(" ");
  const [y, m, d] = datePart.split(".");
  const [hh, mm]  = timePart.split(":");
  return Date.UTC(+y, +m - 1, +d, +hh, +mm, 0) / 1000;
}

function convertFile({ csv, out, label, from }) {
  const csvPath = path.join(CSV_DIR, csv);
  if (!fs.existsSync(csvPath)) {
    console.log(`  ⚠  ${label}: not found → ${csvPath}`);
    return 0;
  }

  const lines   = fs.readFileSync(csvPath, "utf8").split("\n");
  const candles = [];
  const seen    = new Set();

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].trim().split(";");
    if (parts.length < 5) continue;

    const time  = parseDateToUnix(parts[0]);
    if (time < from) continue;

    const open  = parseFloat(parts[1]);
    const high  = parseFloat(parts[2]);
    const low   = parseFloat(parts[3]);
    const close = parseFloat(parts[4]);
    const vol   = parseInt(parts[5] || "0") || 0;

    if (isNaN(open) || high < low || open <= 0) continue;
    if (seen.has(time)) continue;
    seen.add(time);

    candles.push({ time, open, high, low, close, volume: vol });
  }

  if (!candles.length) { console.log(`  ✗  ${label}: no data`); return 0; }

  candles.sort((a, b) => a.time - b.time);
  fs.writeFileSync(path.join(OUT_DIR, out), JSON.stringify(candles));

  const kb   = Math.round(fs.statSync(path.join(OUT_DIR, out)).size / 1024);
  const from0 = new Date(candles[0].time * 1000).toISOString().slice(0, 10);
  const to    = new Date(candles[candles.length-1].time * 1000).toISOString().slice(0, 10);
  console.log(`  ✓  ${label.padEnd(4)} ${candles.length.toLocaleString().padStart(8)} bars  ${from0} → ${to}  (${kb} KB)`);
  return candles.length;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
console.log("\n🔸 Converting XAUUSD CSV → JSON\n");

let total = 0;
for (const cfg of FILES) total += convertFile(cfg);

fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify({
  symbol: "XAUUSD", source: "MetaTrader broker CSV",
  converted_at: new Date().toISOString(),
  files: FILES.map(f => ({ timeframe: f.label, file: f.out, from: new Date(f.from*1000).toISOString().slice(0,10) })),
}, null, 2));

console.log(`\n✅ ${total.toLocaleString()} total bars → public/data/\n`);
