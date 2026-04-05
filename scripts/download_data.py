#!/usr/bin/env python3
"""
XAUUSD Historical Data Downloader
===================================
Downloads XAUUSD (Gold/USD) OHLCV data from Yahoo Finance
and saves as JSON files in public/data/

Requirements:
    pip install yfinance pandas

Usage:
    python scripts/download_data.py
"""

import json
import os
import sys
from datetime import datetime, timedelta

try:
    import yfinance as yf
    import pandas as pd
except ImportError:
    print("Installing required packages...")
    os.system("pip install yfinance pandas")
    import yfinance as yf
    import pandas as pd

# ─── Config ───────────────────────────────────────────────────────────────────
SYMBOL = "GC=F"  # Gold Futures (best proxy for XAUUSD)
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "public", "data")

TIMEFRAMES = {
    "1m":  {"interval": "1m",  "period": "7d",   "file": "xauusd_1m.json"},
    "5m":  {"interval": "5m",  "period": "60d",  "file": "xauusd_5m.json"},
    "15m": {"interval": "15m", "period": "60d",  "file": "xauusd_15m.json"},
    "1h":  {"interval": "1h",  "period": "730d", "file": "xauusd_1h.json"},
    "4h":  {"interval": "1h",  "period": "730d", "file": "xauusd_4h.json"},  # aggregated
    "1D":  {"interval": "1d",  "period": "max",  "file": "xauusd_1d.json"},
}


def to_unix(ts) -> int:
    """Convert pandas Timestamp to Unix seconds."""
    if hasattr(ts, "timestamp"):
        return int(ts.timestamp())
    return int(ts)


def aggregate_to_4h(df_1h: pd.DataFrame) -> pd.DataFrame:
    """Aggregate 1h data to 4h OHLCV."""
    df_1h = df_1h.copy()
    df_1h.index = pd.to_datetime(df_1h.index, utc=True)
    df_4h = df_1h.resample("4h").agg({
        "Open":   "first",
        "High":   "max",
        "Low":    "min",
        "Close":  "last",
        "Volume": "sum",
    }).dropna()
    return df_4h


def download_timeframe(tf_key: str, config: dict) -> list[dict]:
    """Download data for a single timeframe."""
    print(f"  Downloading {tf_key} data ({config['period']})...")

    ticker = yf.Ticker(SYMBOL)

    if tf_key == "4h":
        # Download 1h then aggregate
        df = ticker.history(interval="1h", period=config["period"])
    else:
        df = ticker.history(interval=config["interval"], period=config["period"])

    if df.empty:
        print(f"  ⚠️  No data returned for {tf_key}")
        return []

    # Aggregate if needed
    if tf_key == "4h":
        df = aggregate_to_4h(df)

    # Build candle list
    candles = []
    for ts, row in df.iterrows():
        try:
            candle = {
                "time":   to_unix(ts),
                "open":   round(float(row["Open"]),   2),
                "high":   round(float(row["High"]),   2),
                "low":    round(float(row["Low"]),    2),
                "close":  round(float(row["Close"]),  2),
                "volume": int(row.get("Volume", 0) or 0),
            }
            # Skip clearly invalid candles
            if candle["open"] <= 0 or candle["high"] <= 0:
                continue
            candles.append(candle)
        except Exception as e:
            pass  # Skip bad rows

    # Sort by time (ascending)
    candles.sort(key=lambda c: c["time"])

    # Remove duplicate timestamps
    seen = set()
    unique = []
    for c in candles:
        if c["time"] not in seen:
            seen.add(c["time"])
            unique.append(c)

    print(f"  ✓  {len(unique)} candles downloaded for {tf_key}")
    return unique


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"\n🔸 XAUUSD Data Downloader")
    print(f"   Output: {OUTPUT_DIR}\n")

    results = {}
    for tf_key, config in TIMEFRAMES.items():
        try:
            candles = download_timeframe(tf_key, config)
            if candles:
                out_path = os.path.join(OUTPUT_DIR, config["file"])
                with open(out_path, "w") as f:
                    json.dump(candles, f, separators=(",", ":"))
                size_kb = os.path.getsize(out_path) / 1024
                results[tf_key] = {"count": len(candles), "size_kb": round(size_kb, 1)}
                print(f"  💾 Saved {config['file']} ({size_kb:.1f} KB)\n")
        except Exception as e:
            print(f"  ❌ Error downloading {tf_key}: {e}\n")
            results[tf_key] = {"error": str(e)}

    # Write manifest
    manifest = {
        "symbol": "XAUUSD",
        "source": "Yahoo Finance (GC=F)",
        "downloaded_at": datetime.utcnow().isoformat() + "Z",
        "timeframes": results,
    }
    manifest_path = os.path.join(OUTPUT_DIR, "manifest.json")
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)

    print("\n✅ Download complete!")
    print(f"   Manifest: {manifest_path}")
    print("\nSummary:")
    for tf, info in results.items():
        if "error" in info:
            print(f"  {tf:5s}: ❌ {info['error']}")
        else:
            print(f"  {tf:5s}: {info['count']:6d} candles  ({info['size_kb']} KB)")


if __name__ == "__main__":
    main()
