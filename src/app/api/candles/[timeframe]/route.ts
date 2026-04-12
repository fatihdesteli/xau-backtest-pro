import { NextRequest, NextResponse } from "next/server";
import YahooFinance from "yahoo-finance2";
import type { ChartOptions } from "yahoo-finance2/modules/chart";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinance as any)({ suppressNotices: ["ripHistorical"] }) as InstanceType<typeof YahooFinance>;

// Symbol: GC=F (COMEX Gold Futures) — same source as TradingView MCP
const SYMBOL = "GC=F";

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

/** ms lookback per timeframe */
const TF_LOOKBACK: Record<string, number> = {
  "5m":  60  * 24 * 3600 * 1000,  // 60 days
  "15m": 60  * 24 * 3600 * 1000,  // 60 days
  "30m": 60  * 24 * 3600 * 1000,  // 60 days
  "4h":  730 * 24 * 3600 * 1000,  // 2 years (fetched as 1h then aggregated)
  "1D":  5   * 365 * 24 * 3600 * 1000, // 5 years
};

/** Yahoo Finance interval per timeframe */
const TF_INTERVAL: Record<string, ChartOptions["interval"]> = {
  "5m":  "5m",
  "15m": "15m",
  "30m": "30m",
  "4h":  "60m",  // Yahoo doesn't have 4h — we aggregate from 1h
  "1D":  "1d",
};

/** Aggregate 1h candles into 4h candles aligned to UTC 4h boundaries */
function aggregateTo4h(candles: Candle[]): Candle[] {
  const grouped = new Map<number, Candle[]>();

  for (const c of candles) {
    const d = new Date(c.time * 1000);
    const h = d.getUTCHours();
    // Align to 0,4,8,12,16,20 UTC
    d.setUTCHours(Math.floor(h / 4) * 4, 0, 0, 0);
    const key = Math.floor(d.getTime() / 1000);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(c);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .map(([time, bars]) => ({
      time,
      open:   bars[0].open,
      high:   Math.max(...bars.map((b) => b.high)),
      low:    Math.min(...bars.map((b) => b.low)),
      close:  bars[bars.length - 1].close,
      volume: bars.reduce((s, b) => s + b.volume, 0),
    }));
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ timeframe: string }> }
) {
  const { timeframe: tf } = await params;

  const lookback  = TF_LOOKBACK[tf];
  const yInterval = TF_INTERVAL[tf];
  if (!lookback || !yInterval) {
    return NextResponse.json({ error: "Invalid timeframe" }, { status: 400 });
  }

  try {
    const now     = new Date();
    const period1 = new Date(now.getTime() - lookback);

    const result = await yf.chart(SYMBOL, {
      period1,
      period2: now,
      interval: yInterval,
    });

    const raw: Candle[] = result.quotes
      .filter((q) => q.open != null && q.high != null && q.low != null && q.close != null)
      .map((q) => ({
        time:   Math.floor(new Date(q.date as Date).getTime() / 1000),
        open:   q.open as number,
        high:   q.high as number,
        low:    q.low  as number,
        close:  q.close as number,
        volume: (q.volume as number | null) ?? 0,
      }))
      .filter((c) => c.open > 0 && c.high >= c.low);

    const candles = tf === "4h" ? aggregateTo4h(raw) : raw;

    // Sort ascending by time and remove duplicates
    const seen = new Set<number>();
    const unique = candles
      .sort((a, b) => a.time - b.time)
      .filter((c) => { if (seen.has(c.time)) return false; seen.add(c.time); return true; });

    return NextResponse.json(unique, {
      headers: {
        // Cache for 1 minute — fresh enough for backtesting, avoids Yahoo rate-limits
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    console.error("[candles API]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Veri alınamadı" },
      { status: 500 }
    );
  }
}
