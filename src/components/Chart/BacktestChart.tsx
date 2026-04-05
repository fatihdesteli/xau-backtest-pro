"use client";

import {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickSeriesOptions,
  type Time,
  LineStyle,
  CrosshairMode,
} from "lightweight-charts";
import { useBacktestStore } from "@/lib/store";
import { CHART_COLORS, DEFAULT_DRAWING_COLOR } from "@/lib/constants";
import type { DrawingObject, DrawingToolType } from "@/lib/types";
import { v4 as uuidv4 } from "uuid";

export interface BacktestChartHandle {
  getChart: () => IChartApi | null;
  takeScreenshot: () => string | null;
}

interface Props {
  onCrosshairPrice?: (price: number | null) => void;
  onChartClick?: (time: number, price: number) => void;
}

// Fibonacci levels
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = ["#888", "#f59e0b", "#3b82f6", "#a855f7", "#22c55e", "#3b82f6", "#888"];

// ─────────────────────────────────────────────────────────────────────────────

const BacktestChart = forwardRef<BacktestChartHandle, Props>(
  ({ onCrosshairPrice, onChartClick }, ref) => {
    const containerRef   = useRef<HTMLDivElement>(null);
    const overlayRef     = useRef<HTMLCanvasElement>(null);
    const chartRef       = useRef<IChartApi | null>(null);
    const seriesRef      = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const rafRef         = useRef<number | null>(null);

    // ── Store ─────────────────────────────────────────────────────────────────
    const candles         = useBacktestStore((s) => s.candles);
    const currentBarIndex = useBacktestStore((s) => s.currentBarIndex);
    const trades          = useBacktestStore((s) => s.trades);
    const activeTool      = useBacktestStore((s) => s.activeTool);
    const drawings        = useBacktestStore((s) => s.drawings);
    const addDrawing      = useBacktestStore((s) => s.addDrawing);
    const setActiveTool   = useBacktestStore((s) => s.setActiveTool);
    const updateTradeLevel = useBacktestStore((s) => s.updateTradeLevel);

    // Stable refs (avoid stale closures in RAF/events)
    const candlesRef      = useRef(candles);
    const barRef          = useRef(currentBarIndex);
    const tradesRef       = useRef(trades);
    const drawingsRef     = useRef(drawings);
    const activeToolRef   = useRef(activeTool);
    const activeColorRef  = useRef(DEFAULT_DRAWING_COLOR);

    useEffect(() => { candlesRef.current = candles; }, [candles]);
    useEffect(() => { barRef.current = currentBarIndex; }, [currentBarIndex]);
    useEffect(() => { tradesRef.current = trades; }, [trades]);
    useEffect(() => { drawingsRef.current = drawings; }, [drawings]);
    useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

    // ── Drawing state (local, not in store) ───────────────────────────────────
    const drawState = useRef<{
      active: boolean;
      p1: { time: number; price: number } | null;
      mouseX: number;
      mouseY: number;
    }>({ active: false, p1: null, mouseX: 0, mouseY: 0 });

    // ── TP/SL drag state ──────────────────────────────────────────────────────
    const dragState = useRef<{
      tradeId: string;
      field: "stopLoss" | "takeProfit";
    } | null>(null);

    // ─── Coordinate helpers ───────────────────────────────────────────────────
    const toPixelX = useCallback((time: number): number | null => {
      return chartRef.current?.timeScale().timeToCoordinate(time as Time) ?? null;
    }, []);

    const toPixelY = useCallback((price: number): number | null => {
      return seriesRef.current?.priceToCoordinate(price) ?? null;
    }, []);

    const toTime = useCallback((x: number): number | null => {
      const t = chartRef.current?.timeScale().coordinateToTime(x);
      return t != null ? (t as number) : null;
    }, []);

    const toPrice = useCallback((y: number): number | null => {
      return seriesRef.current?.coordinateToPrice(y) ?? null;
    }, []);

    // ─── Canvas draw ──────────────────────────────────────────────────────────
    const drawOverlay = useCallback(() => {
      const canvas = overlayRef.current;
      if (!canvas || !chartRef.current || !seriesRef.current) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      const W = canvas.width / dpr;
      const H = canvas.height / dpr;

      // ── Draw stored drawings ─────────────────────────────────────────────
      for (const d of drawingsRef.current) {
        drawOne(ctx, d, W, H);
      }

      // ── In-progress preview ──────────────────────────────────────────────
      const ds = drawState.current;
      const tool = activeToolRef.current;
      if (ds.active && ds.p1 && tool !== "none") {
        const { mouseX: mx, mouseY: my } = ds;
        const p1x = toPixelX(ds.p1.time);
        const p1y = toPixelY(ds.p1.price);
        if (p1x !== null && p1y !== null) {
          drawPreview(ctx, tool, p1x, p1y, mx, my, W, H);
        }
      }

      // ── TP/SL lines for open trades ──────────────────────────────────────
      const visibleCandles = candlesRef.current.slice(0, barRef.current + 1);
      for (const trade of tradesRef.current) {
        if (trade.status !== "open") continue;
        const entryY = toPixelY(trade.entryPrice);
        const entryX = toPixelX(visibleCandles[trade.entryBarIndex]?.time ?? 0);
        const lastX  = toPixelX(visibleCandles[visibleCandles.length - 1]?.time ?? 0);

        if (entryY !== null && entryX !== null && lastX !== null) {
          drawTradeLine(ctx, entryX, lastX, entryY, "#3b82f6", "Entry", W, false);
        }
        if (trade.takeProfit !== null) {
          const tpy = toPixelY(trade.takeProfit);
          if (tpy !== null) {
            drawTradeLine(ctx, 0, W, tpy, "#22c55e", `TP  ${trade.takeProfit.toFixed(2)}`, W, true);
            // Drag handle
            drawDragHandle(ctx, W - 60, tpy, "#22c55e");
          }
        }
        if (trade.stopLoss !== null) {
          const sly = toPixelY(trade.stopLoss);
          if (sly !== null) {
            drawTradeLine(ctx, 0, W, sly, "#ef4444", `SL  ${trade.stopLoss.toFixed(2)}`, W, true);
            drawDragHandle(ctx, W - 60, sly, "#ef4444");
          }
        }
      }

      ctx.restore();
    }, [toPixelX, toPixelY]);

    // Draw a single stored drawing
    function drawOne(ctx: CanvasRenderingContext2D, d: DrawingObject, W: number, H: number) {
      ctx.strokeStyle = d.color;
      ctx.lineWidth = d.lineWidth;
      ctx.setLineDash(d.lineStyle === "dashed" ? [6, 4] : d.lineStyle === "dotted" ? [2, 4] : []);
      ctx.font = "11px Inter, sans-serif";

      if (d.type === "horizontal" && d.points.length >= 1) {
        const y = toPixelY(d.points[0].price);
        if (y === null) return;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = d.color;
        ctx.fillText(d.points[0].price.toFixed(2), 4, y - 4);
      }

      else if (d.type === "vertical" && d.points.length >= 1) {
        const x = toPixelX(d.points[0].time);
        if (x === null) return;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }

      else if ((d.type === "trendline" || d.type === "ray") && d.points.length >= 2) {
        const x1 = toPixelX(d.points[0].time);
        const y1 = toPixelY(d.points[0].price);
        const x2 = toPixelX(d.points[1].time);
        const y2 = toPixelY(d.points[1].price);
        if (x1 === null || y1 === null || x2 === null || y2 === null) return;

        let endX = x2, endY = y2;
        if (d.type === "ray" && x2 !== x1) {
          // Extend to edge of canvas
          const slope = (y2 - y1) / (x2 - x1);
          endX = W;
          endY = y1 + slope * (W - x1);
        }
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        // Dots at endpoints
        ctx.setLineDash([]);
        ctx.fillStyle = d.color;
        ctx.beginPath(); ctx.arc(x1, y1, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x2, y2, 3, 0, Math.PI * 2); ctx.fill();
      }

      else if (d.type === "rectangle" && d.points.length >= 2) {
        const x1 = toPixelX(d.points[0].time);
        const y1 = toPixelY(d.points[0].price);
        const x2 = toPixelX(d.points[1].time);
        const y2 = toPixelY(d.points[1].price);
        if (x1 === null || y1 === null || x2 === null || y2 === null) return;
        ctx.beginPath();
        ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
        const r = hexToRgb(d.color);
        ctx.fillStyle = r ? `rgba(${r.r},${r.g},${r.b},0.07)` : "rgba(255,255,255,0.05)";
        ctx.fill();
        ctx.stroke();
      }

      else if (d.type === "fibonacci" && d.points.length >= 2) {
        const price1 = d.points[0].price;
        const price2 = d.points[1].price;
        const range = price1 - price2; // top to bottom

        FIB_LEVELS.forEach((lvl, i) => {
          const fibPrice = price2 + range * lvl;
          const fy = toPixelY(fibPrice);
          if (fy === null) return;

          ctx.strokeStyle = FIB_COLORS[i] || d.color;
          ctx.lineWidth = lvl === 0 || lvl === 1 ? 1.5 : 1;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(0, fy);
          ctx.lineTo(W, fy);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = FIB_COLORS[i] || d.color;
          ctx.font = "10px Inter, monospace";
          ctx.fillText(
            `${(lvl * 100).toFixed(1)}%  ${fibPrice.toFixed(2)}`,
            4, fy - 3
          );
        });
      }
    }

    // Preview while drawing (before second click)
    function drawPreview(
      ctx: CanvasRenderingContext2D,
      tool: DrawingToolType,
      p1x: number, p1y: number,
      mx: number, my: number,
      W: number, H: number
    ) {
      ctx.strokeStyle = activeColorRef.current;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.globalAlpha = 0.7;

      if (tool === "trendline" || tool === "ray") {
        ctx.beginPath();
        ctx.moveTo(p1x, p1y);
        if (tool === "ray") {
          const slope = mx !== p1x ? (my - p1y) / (mx - p1x) : 0;
          ctx.lineTo(W, p1y + slope * (W - p1x));
        } else {
          ctx.lineTo(mx, my);
        }
        ctx.stroke();
      } else if (tool === "rectangle") {
        ctx.beginPath();
        ctx.rect(Math.min(p1x, mx), Math.min(p1y, my), Math.abs(mx - p1x), Math.abs(my - p1y));
        ctx.stroke();
      } else if (tool === "fibonacci") {
        // Preview fib between p1y and my
        const priceStart = toPrice(p1y) ?? 0;
        const priceCur   = toPrice(my) ?? 0;
        const range = priceStart - priceCur;
        FIB_LEVELS.forEach((lvl, i) => {
          const fibPrice = priceCur + range * lvl;
          const fy = toPixelY(fibPrice);
          if (fy === null) return;
          ctx.strokeStyle = FIB_COLORS[i];
          ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(W, fy); ctx.stroke();
        });
      }

      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      // Dot at start
      ctx.fillStyle = activeColorRef.current;
      ctx.beginPath(); ctx.arc(p1x, p1y, 3, 0, Math.PI * 2); ctx.fill();
    }

    function drawTradeLine(
      ctx: CanvasRenderingContext2D,
      x1: number, x2: number, y: number,
      color: string, label: string,
      W: number, dashed: boolean
    ) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash(dashed ? [6, 4] : []);
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Label background
      ctx.font = "bold 10px Inter, monospace";
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = color + "30";
      ctx.fillRect(4, y - 13, tw + 8, 14);
      ctx.fillStyle = color;
      ctx.fillText(label, 8, y - 2);
    }

    function drawDragHandle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
      ctx.fillStyle = color;
      ctx.strokeStyle = "#0d0d0d";
      ctx.lineWidth = 1.5;
      // Arrow/triangle handle
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + 12, y);
      ctx.lineTo(x, y + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // ─── RAF render loop ─────────────────────────────────────────────────────
    useEffect(() => {
      let running = true;
      const loop = () => {
        if (!running) return;
        drawOverlay();
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
      return () => {
        running = false;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, [drawOverlay]);

    // ─── Init Lightweight Chart ───────────────────────────────────────────────
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
          vertLine: { color: "#3a3a3a", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1e2028" },
          horzLine: { color: "#3a3a3a", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1e2028" },
        },
        rightPriceScale: {
          borderColor: "#1e2028",
          textColor: CHART_COLORS.text,
          scaleMargins: { top: 0.08, bottom: 0.08 },
        },
        timeScale: {
          borderColor: "#1e2028",
          timeVisible: true,
          secondsVisible: false,
        },
        handleScroll: true,
        handleScale: true,
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });

      const series = chart.addSeries(CandlestickSeries, {
        upColor:        CHART_COLORS.bullCandle,
        downColor:      CHART_COLORS.bearCandle,
        borderUpColor:  CHART_COLORS.bullBorder,
        borderDownColor:CHART_COLORS.bearBorder,
        wickUpColor:    CHART_COLORS.bullBorder,
        wickDownColor:  CHART_COLORS.bearBorder,
      } as Partial<CandlestickSeriesOptions>);

      chartRef.current = chart;
      seriesRef.current = series;

      // Crosshair → emit price
      chart.subscribeCrosshairMove((param) => {
        if (onCrosshairPrice) {
          if (param.point && series) {
            const d = param.seriesData.get(series);
            onCrosshairPrice(d && "close" in d ? (d as { close: number }).close : null);
          } else {
            onCrosshairPrice(null);
          }
        }
      });

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (!containerRef.current) return;
        const { clientWidth: w, clientHeight: h } = containerRef.current;
        chart.applyOptions({ width: w, height: h });
        resizeOverlay();
      });
      ro.observe(containerRef.current);

      return () => {
        ro.disconnect();
        chart.remove();
        chartRef.current = null;
        seriesRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Sync overlay canvas size to container ────────────────────────────────
    const resizeOverlay = useCallback(() => {
      const canvas = overlayRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = container.clientWidth  * dpr;
      canvas.height = container.clientHeight * dpr;
      canvas.style.width  = `${container.clientWidth}px`;
      canvas.style.height = `${container.clientHeight}px`;
    }, []);

    useEffect(() => {
      resizeOverlay();
    }, [resizeOverlay]);

    // ─── Update candle data ───────────────────────────────────────────────────
    useEffect(() => {
      const series = seriesRef.current;
      if (!series || candles.length === 0) return;
      const visible = candles.slice(0, currentBarIndex + 1);
      series.setData(visible.map((c) => ({
        time:  c.time as Time,
        open:  c.open,
        high:  c.high,
        low:   c.low,
        close: c.close,
      })));
      // Keep latest bar visible with some right margin
      chartRef.current?.timeScale().scrollToPosition(10, false);
    }, [candles, currentBarIndex]);

    // ─── Mouse helpers ────────────────────────────────────────────────────────
    const getCanvasPos = (e: React.MouseEvent): { x: number; y: number } => {
      const canvas = overlayRef.current!;
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const findDragTarget = (y: number): { tradeId: string; field: "stopLoss" | "takeProfit" } | null => {
      const THRESHOLD = 8; // pixels
      for (const trade of tradesRef.current) {
        if (trade.status !== "open") continue;
        if (trade.takeProfit !== null) {
          const py = toPixelY(trade.takeProfit);
          if (py !== null && Math.abs(y - py) < THRESHOLD) {
            return { tradeId: trade.id, field: "takeProfit" };
          }
        }
        if (trade.stopLoss !== null) {
          const sy = toPixelY(trade.stopLoss);
          if (sy !== null && Math.abs(y - sy) < THRESHOLD) {
            return { tradeId: trade.id, field: "stopLoss" };
          }
        }
      }
      return null;
    };

    // ─── Mouse events on overlay ──────────────────────────────────────────────
    const handleMouseDown = (e: React.MouseEvent) => {
      const { x, y } = getCanvasPos(e);
      const tool = activeToolRef.current;

      // Priority 1: TP/SL drag (only when tool=none)
      if (tool === "none") {
        const target = findDragTarget(y);
        if (target) {
          dragState.current = { tradeId: target.tradeId, field: target.field };
          e.stopPropagation();
          return;
        }
        return; // let chart handle scroll/zoom
      }

      // Priority 2: Single-click tools (horizontal, vertical)
      if (tool === "horizontal") {
        const price = toPrice(y);
        if (price !== null) {
          addDrawing({
            id: uuidv4(), type: "horizontal",
            points: [{ time: 0, price }],
            color: activeColorRef.current, lineWidth: 1, lineStyle: "solid", locked: false,
          });
          setActiveTool("none");
        }
        return;
      }
      if (tool === "vertical") {
        const time = toTime(x);
        if (time !== null) {
          addDrawing({
            id: uuidv4(), type: "vertical",
            points: [{ time, price: 0 }],
            color: activeColorRef.current, lineWidth: 1, lineStyle: "solid", locked: false,
          });
          setActiveTool("none");
        }
        return;
      }

      // Priority 3: Two-click tools
      const ds = drawState.current;
      if (!ds.active) {
        // First click
        const time = toTime(x);
        const price = toPrice(y);
        if (time !== null && price !== null) {
          drawState.current = { active: true, p1: { time, price }, mouseX: x, mouseY: y };
        }
      } else {
        // Second click → complete drawing
        const time = toTime(x);
        const price = toPrice(y);
        if (time !== null && price !== null && ds.p1) {
          addDrawing({
            id: uuidv4(), type: tool as DrawingToolType,
            points: [ds.p1, { time, price }],
            color: activeColorRef.current, lineWidth: 1, lineStyle: "solid", locked: false,
          });
          drawState.current = { active: false, p1: null, mouseX: 0, mouseY: 0 };
          setActiveTool("none");
        }
      }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      const { x, y } = getCanvasPos(e);
      const canvas = overlayRef.current;
      if (!canvas) return;

      // Update preview coords
      drawState.current.mouseX = x;
      drawState.current.mouseY = y;

      // TP/SL dragging
      if (dragState.current) {
        const price = toPrice(y);
        if (price !== null) {
          updateTradeLevel(dragState.current.tradeId, dragState.current.field, price);
        }
        return;
      }

      // Cursor feedback
      const tool = activeToolRef.current;
      if (tool !== "none") {
        canvas.style.cursor = "crosshair";
      } else {
        const target = findDragTarget(y);
        canvas.style.cursor = target ? "ns-resize" : "default";
      }
    };

    const handleMouseUp = () => {
      dragState.current = null;
    };

    // Escape cancels in-progress drawing
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          drawState.current = { active: false, p1: null, mouseX: 0, mouseY: 0 };
          setActiveTool("none");
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [setActiveTool]);

    // ─── Expose color setter ──────────────────────────────────────────────────
    useEffect(() => {
      // Listen for color change events from DrawingToolbar
      const handler = (e: CustomEvent) => {
        activeColorRef.current = e.detail;
      };
      window.addEventListener("drawingColorChange", handler as EventListener);
      return () => window.removeEventListener("drawingColorChange", handler as EventListener);
    }, []);

    // ─── Imperative handle ────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      getChart: () => chartRef.current,
      takeScreenshot: () => {
        const chart = chartRef.current;
        if (!chart) return null;
        return chart.takeScreenshot().toDataURL("image/png");
      },
    }));

    // ─── Overlay pointer-events ───────────────────────────────────────────────
    const overlayPointerEvents = activeTool !== "none" ? "all" : "all"; // always on for TP/SL drag

    return (
      <div ref={containerRef} className="w-full h-full relative select-none">
        <canvas
          ref={overlayRef}
          className="absolute inset-0 z-10"
          style={{ pointerEvents: overlayPointerEvents }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
    );
  }
);

BacktestChart.displayName = "BacktestChart";
export default BacktestChart;

// ─── Utility ─────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}
