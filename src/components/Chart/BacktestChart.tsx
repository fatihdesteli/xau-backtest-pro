"use client";

import {
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickSeriesOptions,
  type Time,
  LineStyle,
  CrosshairMode,
} from "lightweight-charts";
import { useBacktestStore } from "@/lib/store";
import { CHART_COLORS } from "@/lib/constants";
import type { OHLCVCandle, Trade } from "@/lib/types";

export interface BacktestChartHandle {
  getChart: () => IChartApi | null;
  scrollToBar: (index: number) => void;
  takeScreenshot: () => string | null;
}

interface Props {
  onCrosshairPrice?: (price: number | null) => void;
  onChartClick?: (time: number, price: number, x: number, y: number) => void;
}

const VISIBLE_BARS = 120;

const BacktestChart = forwardRef<BacktestChartHandle, Props>(
  ({ onCrosshairPrice, onChartClick }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const tradeLineSeriesRef = useRef<Map<string, ISeriesApi<"Line">[]>>(new Map());

    const candles = useBacktestStore((s) => s.candles);
    const currentBarIndex = useBacktestStore((s) => s.currentBarIndex);
    const trades = useBacktestStore((s) => s.trades);
    const activeTool = useBacktestStore((s) => s.activeTool);

    // ── Init chart ──────────────────────────────────────────────────────────
    useEffect(() => {
      if (!containerRef.current) return;

      const chart = createChart(containerRef.current, {
        layout: {
          background: { color: CHART_COLORS.background },
          textColor: CHART_COLORS.text,
          fontSize: 11,
          fontFamily: "'Inter', -apple-system, sans-serif",
        },
        grid: {
          vertLines: { color: CHART_COLORS.grid },
          horzLines: { color: CHART_COLORS.grid },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "#444", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1e2028" },
          horzLine: { color: "#444", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1e2028" },
        },
        rightPriceScale: {
          borderColor: "#1e2028",
          textColor: CHART_COLORS.text,
          scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        timeScale: {
          borderColor: "#1e2028",
          timeVisible: true,
          secondsVisible: false,
          fixLeftEdge: false,
          fixRightEdge: false,
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
        handleScale: { mouseWheel: true, pinch: true },
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });

      const candleSeries = chart.addSeries(CandlestickSeries, {
        upColor: CHART_COLORS.bullCandle,
        downColor: CHART_COLORS.bearCandle,
        borderUpColor: CHART_COLORS.bullBorder,
        borderDownColor: CHART_COLORS.bearBorder,
        wickUpColor: CHART_COLORS.bullBorder,
        wickDownColor: CHART_COLORS.bearBorder,
      } as Partial<CandlestickSeriesOptions>);

      chartRef.current = chart;
      candleSeriesRef.current = candleSeries;

      // Crosshair move → emit price
      chart.subscribeCrosshairMove((param) => {
        if (param.point && candleSeries && onCrosshairPrice) {
          const price = param.seriesData.get(candleSeries);
          if (price && "close" in price) {
            onCrosshairPrice((price as { close: number }).close);
          } else {
            onCrosshairPrice(null);
          }
        }
      });

      // Click handler
      chart.subscribeClick((param) => {
        if (param.point && param.time && onChartClick && candleSeries) {
          const price = candleSeries.coordinateToPrice(param.point.y);
          if (price !== null) {
            onChartClick(param.time as number, price, param.point.x, param.point.y);
          }
        }
      });

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (containerRef.current) {
          chart.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        }
      });
      if (containerRef.current) ro.observe(containerRef.current);

      return () => {
        ro.disconnect();
        chart.remove();
        chartRef.current = null;
        candleSeriesRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Update candle data when currentBarIndex changes ──────────────────────
    useEffect(() => {
      const series = candleSeriesRef.current;
      if (!series || candles.length === 0) return;

      // Only show candles up to currentBarIndex (replay mode)
      const visible = candles.slice(0, currentBarIndex + 1);
      const data = visible.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      series.setData(data);

      // Auto-scroll to keep latest candle in view
      if (chartRef.current && visible.length > 0) {
        chartRef.current.timeScale().scrollToPosition(8, false);
      }
    }, [candles, currentBarIndex]);

    // ── Draw trade levels (entry, TP, SL) ───────────────────────────────────
    useEffect(() => {
      const chart = chartRef.current;
      if (!chart || !candleSeriesRef.current) return;

      // Remove old trade lines
      tradeLineSeriesRef.current.forEach((seriesList) => {
        seriesList.forEach((s) => {
          try { chart.removeSeries(s); } catch {}
        });
      });
      tradeLineSeriesRef.current.clear();

      // Draw open trades
      const openTrades = trades.filter((t) => t.status === "open");
      const visibleCandles = candles.slice(0, currentBarIndex + 1);
      if (visibleCandles.length === 0) return;

      openTrades.forEach((trade) => {
        const lines: ISeriesApi<"Line">[] = [];

        // Helper to create a horizontal price line
        const makeLine = (price: number, color: string, lineWidth: 1 | 2 | 3 | 4, isDashed = false) => {
          const s = chart.addSeries(LineSeries, {
            color,
            lineWidth,
            lineStyle: isDashed ? LineStyle.Dashed : LineStyle.Solid,
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false,
          });

          const entryCandle = candles[trade.entryBarIndex];
          const lastCandle = visibleCandles[visibleCandles.length - 1];

          if (entryCandle && lastCandle) {
            s.setData([
              { time: entryCandle.time as Time, value: price },
              { time: lastCandle.time as Time, value: price },
            ]);
          }
          return s;
        };

        // Entry line
        const entryLine = makeLine(trade.entryPrice, CHART_COLORS.entryLine, 1, true);
        lines.push(entryLine);

        // TP line
        if (trade.takeProfit !== null) {
          const tpLine = makeLine(trade.takeProfit, CHART_COLORS.tpLine, 1, true);
          lines.push(tpLine);
        }

        // SL line
        if (trade.stopLoss !== null) {
          const slLine = makeLine(trade.stopLoss, CHART_COLORS.slLine, 1, true);
          lines.push(slLine);
        }

        tradeLineSeriesRef.current.set(trade.id, lines);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [trades, currentBarIndex]);

    // ── Cursor based on active tool ──────────────────────────────────────────
    useEffect(() => {
      if (!containerRef.current) return;
      containerRef.current.style.cursor =
        activeTool !== "none" ? "crosshair" : "default";
    }, [activeTool]);

    // ── Imperative handle ────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      getChart: () => chartRef.current,
      scrollToBar: (index: number) => {
        const chart = chartRef.current;
        const candle = candles[index];
        if (chart && candle) {
          chart.timeScale().scrollToPosition(0, false);
        }
      },
      takeScreenshot: () => {
        const chart = chartRef.current;
        if (!chart) return null;
        const canvas = chart.takeScreenshot();
        return canvas.toDataURL("image/png");
      },
    }));

    return (
      <div ref={containerRef} className="w-full h-full" />
    );
  }
);

BacktestChart.displayName = "BacktestChart";
export default BacktestChart;
