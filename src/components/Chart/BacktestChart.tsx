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
}

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const FIB_COLORS = ["#888", "#f59e0b", "#3b82f6", "#a855f7", "#22c55e", "#3b82f6", "#888"];

const BacktestChart = forwardRef<BacktestChartHandle, Props>(
  ({ onCrosshairPrice }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    // Canvas is RENDER-ONLY — pointer-events: none always
    const canvasRef    = useRef<HTMLCanvasElement>(null);
    // Drawing div — captures events only when a tool is active
    const drawDivRef   = useRef<HTMLDivElement>(null);
    const chartRef     = useRef<IChartApi | null>(null);
    const seriesRef    = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const rafRef       = useRef<number | null>(null);

    // TP/SL handle DOM refs — updated imperatively in RAF loop
    const tpHandleRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const slHandleRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // ── Store ─────────────────────────────────────────────────────────────────
    const candles          = useBacktestStore((s) => s.candles);
    const currentBarIndex  = useBacktestStore((s) => s.currentBarIndex);
    const trades           = useBacktestStore((s) => s.trades);
    const activeTool       = useBacktestStore((s) => s.activeTool);
    const drawings         = useBacktestStore((s) => s.drawings);
    const addDrawing       = useBacktestStore((s) => s.addDrawing);
    const setActiveTool    = useBacktestStore((s) => s.setActiveTool);
    const updateTradeLevel = useBacktestStore((s) => s.updateTradeLevel);

    // Stable refs (stale-closure-safe for RAF/event handlers)
    const candlesRef     = useRef(candles);
    const barRef         = useRef(currentBarIndex);
    const tradesRef      = useRef(trades);
    const drawingsRef    = useRef(drawings);
    const activeToolRef  = useRef(activeTool);
    const colorRef       = useRef(DEFAULT_DRAWING_COLOR);

    useEffect(() => { candlesRef.current = candles; },         [candles]);
    useEffect(() => { barRef.current = currentBarIndex; },     [currentBarIndex]);
    useEffect(() => { tradesRef.current = trades; },           [trades]);
    useEffect(() => { drawingsRef.current = drawings; },       [drawings]);
    useEffect(() => { activeToolRef.current = activeTool; },   [activeTool]);

    // In-progress drawing state (NOT in React state — avoids re-renders)
    const drawState = useRef<{
      active: boolean;
      p1: { time: number; price: number } | null;
      mx: number; my: number;
    }>({ active: false, p1: null, mx: 0, my: 0 });

    // Active TP/SL drag
    const dragRef = useRef<{ tradeId: string; field: "stopLoss" | "takeProfit" } | null>(null);

    // ── Coordinate helpers ────────────────────────────────────────────────────
    // Cast to plain number — LW Charts v5 uses branded Coordinate type internally
    const toX = (t: number): number | null => { const v = chartRef.current?.timeScale().timeToCoordinate(t as Time); return v != null ? (v as unknown as number) : null; };
    const toY = (p: number): number | null => { const v = seriesRef.current?.priceToCoordinate(p); return v != null ? (v as unknown as number) : null; };
    const toTime  = (x: number) => { const t = chartRef.current?.timeScale().coordinateToTime(x); return t != null ? (t as number) : null; };
    const toPrice = (y: number) => seriesRef.current?.coordinateToPrice(y) ?? null;

    // ── Canvas render loop ────────────────────────────────────────────────────
    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas || !chartRef.current || !seriesRef.current) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;

      // Stored drawings
      for (const d of drawingsRef.current) renderDrawing(ctx, d, W, H);

      // In-progress preview
      const ds = drawState.current;
      const tool = activeToolRef.current;
      if (ds.active && ds.p1 && tool !== "none") {
        const p1x = toX(ds.p1.time);
        const p1y = toY(ds.p1.price);
        if (p1x !== null && p1y !== null)
          renderPreview(ctx, tool, p1x, p1y, ds.mx, ds.my, W);
      }

      // Trade level lines + update handle positions
      const vis = candlesRef.current.slice(0, barRef.current + 1);
      for (const trade of tradesRef.current) {
        if (trade.status !== "open") continue;
        const ey   = toY(trade.entryPrice);
        const ex   = toX(vis[trade.entryBarIndex]?.time ?? 0);
        const last = toX(vis[vis.length - 1]?.time ?? 0);
        if (ey !== null && ex !== null && last !== null)
          line(ctx, ex, last, ey, "#3b82f6", `Entry  ${trade.entryPrice.toFixed(2)}`, false);

        if (trade.takeProfit !== null) {
          const ty = toY(trade.takeProfit);
          if (ty !== null) {
            line(ctx, 0, W, ty, "#22c55e", `TP  ${trade.takeProfit.toFixed(2)}`, true);
            const el = tpHandleRefs.current.get(trade.id);
            if (el) el.style.top = `${ty - 8}px`;
          }
        }
        if (trade.stopLoss !== null) {
          const sy = toY(trade.stopLoss);
          if (sy !== null) {
            line(ctx, 0, W, sy, "#ef4444", `SL  ${trade.stopLoss.toFixed(2)}`, true);
            const el = slHandleRefs.current.get(trade.id);
            if (el) el.style.top = `${sy - 8}px`;
          }
        }
      }

      ctx.restore();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    function renderDrawing(ctx: CanvasRenderingContext2D, d: DrawingObject, W: number, H: number) {
      ctx.strokeStyle = d.color;
      ctx.lineWidth   = d.lineWidth;
      ctx.setLineDash(d.lineStyle === "dashed" ? [6, 4] : d.lineStyle === "dotted" ? [2, 4] : []);
      ctx.font = "11px Inter, sans-serif";

      if (d.type === "horizontal" && d.points.length) {
        const y = toY(d.points[0].price); if (y === null) return;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = d.color;
        ctx.fillText(d.points[0].price.toFixed(2), 4, y - 4);

      } else if (d.type === "vertical" && d.points.length) {
        const x = toX(d.points[0].time); if (x === null) return;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();

      } else if ((d.type === "trendline" || d.type === "ray") && d.points.length >= 2) {
        const x1 = toX(d.points[0].time), y1 = toY(d.points[0].price);
        const x2 = toX(d.points[1].time), y2 = toY(d.points[1].price);
        if (x1 === null || y1 === null || x2 === null || y2 === null) return;
        let ex = x2, ey = y2;
        if (d.type === "ray" && x2 !== x1) {
          const s = (y2 - y1) / (x2 - x1);
          ex = W; ey = y1 + s * (W - x1);
        }
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = d.color;
        ctx.beginPath(); ctx.arc(x1, y1, 3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x2, y2, 3, 0, Math.PI * 2); ctx.fill();

      } else if (d.type === "rectangle" && d.points.length >= 2) {
        const x1 = toX(d.points[0].time), y1 = toY(d.points[0].price);
        const x2 = toX(d.points[1].time), y2 = toY(d.points[1].price);
        if (x1 === null || y1 === null || x2 === null || y2 === null) return;
        const r = hexToRgb(d.color);
        ctx.fillStyle = r ? `rgba(${r.r},${r.g},${r.b},0.07)` : "rgba(255,255,255,0.05)";
        ctx.beginPath();
        ctx.rect(Math.min(x1,x2), Math.min(y1,y2), Math.abs(x2-x1), Math.abs(y2-y1));
        ctx.fill(); ctx.stroke();

      } else if (d.type === "fibonacci" && d.points.length >= 2) {
        const range = d.points[0].price - d.points[1].price;
        FIB_LEVELS.forEach((lvl, i) => {
          const fy = toY(d.points[1].price + range * lvl); if (fy === null) return;
          ctx.strokeStyle = FIB_COLORS[i]; ctx.lineWidth = (lvl===0||lvl===1)?1.5:1;
          ctx.setLineDash([4, 3]);
          ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(W, fy); ctx.stroke();
          ctx.setLineDash([]); ctx.fillStyle = FIB_COLORS[i]; ctx.font = "10px monospace";
          ctx.fillText(`${(lvl*100).toFixed(1)}%  ${(d.points[1].price+range*lvl).toFixed(2)}`, 4, fy-3);
        });
      }
      ctx.setLineDash([]);
    }

    function renderPreview(ctx: CanvasRenderingContext2D, tool: DrawingToolType,
      p1x: number, p1y: number, mx: number, my: number, W: number) {
      ctx.strokeStyle = colorRef.current; ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]); ctx.globalAlpha = 0.7;

      if (tool === "trendline" || tool === "ray") {
        ctx.beginPath(); ctx.moveTo(p1x, p1y);
        if (tool === "ray") {
          const s = mx !== p1x ? (my - p1y) / (mx - p1x) : 0;
          ctx.lineTo(W, p1y + s * (W - p1x));
        } else ctx.lineTo(mx, my);
        ctx.stroke();
      } else if (tool === "rectangle") {
        ctx.beginPath();
        ctx.rect(Math.min(p1x,mx), Math.min(p1y,my), Math.abs(mx-p1x), Math.abs(my-p1y));
        ctx.stroke();
      } else if (tool === "fibonacci") {
        const priceTop = toPrice(p1y) ?? 0, priceCur = toPrice(my) ?? 0;
        const range = priceTop - priceCur;
        FIB_LEVELS.forEach((lvl, i) => {
          const fy = toY(priceCur + range * lvl); if (fy === null) return;
          ctx.strokeStyle = FIB_COLORS[i];
          ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(W, fy); ctx.stroke();
        });
      }
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.fillStyle = colorRef.current;
      ctx.beginPath(); ctx.arc(p1x, p1y, 3, 0, Math.PI*2); ctx.fill();
    }

    function line(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number,
      color: string, label: string, dashed: boolean) {
      ctx.strokeStyle = color; ctx.lineWidth = 1;
      ctx.setLineDash(dashed ? [6, 4] : []); ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.font = "bold 10px Inter, monospace";
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = color + "25"; ctx.fillRect(4, y - 13, tw + 8, 14);
      ctx.fillStyle = color; ctx.fillText(label, 8, y - 2);
    }

    // ── RAF loop ──────────────────────────────────────────────────────────────
    useEffect(() => {
      let alive = true;
      const loop = () => { if (!alive) return; draw(); rafRef.current = requestAnimationFrame(loop); };
      rafRef.current = requestAnimationFrame(loop);
      return () => { alive = false; if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    }, [draw]);

    // ── Init LW chart ─────────────────────────────────────────────────────────
    useEffect(() => {
      if (!containerRef.current) return;
      const chart = createChart(containerRef.current, {
        layout: { background: { color: CHART_COLORS.background }, textColor: CHART_COLORS.text, fontSize: 11, fontFamily: "'Inter', -apple-system, sans-serif" },
        grid:   { vertLines: { color: CHART_COLORS.grid }, horzLines: { color: CHART_COLORS.grid } },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "#3a3a3a", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1e2028" },
          horzLine: { color: "#3a3a3a", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1e2028" },
        },
        rightPriceScale: { borderColor: "#1e2028", textColor: CHART_COLORS.text, scaleMargins: { top: 0.08, bottom: 0.08 } },
        timeScale: { borderColor: "#1e2028", timeVisible: true, secondsVisible: false },
        handleScroll: true,
        handleScale: true,
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });

      const series = chart.addSeries(CandlestickSeries, {
        upColor: CHART_COLORS.bullCandle, downColor: CHART_COLORS.bearCandle,
        borderUpColor: CHART_COLORS.bullBorder, borderDownColor: CHART_COLORS.bearBorder,
        wickUpColor: CHART_COLORS.bullBorder, wickDownColor: CHART_COLORS.bearBorder,
      } as Partial<CandlestickSeriesOptions>);

      chartRef.current = chart;
      seriesRef.current = series;

      chart.subscribeCrosshairMove((param) => {
        if (!onCrosshairPrice) return;
        const d = param.point ? param.seriesData.get(series) : undefined;
        onCrosshairPrice(d && "close" in d ? (d as { close: number }).close : null);
      });

      const ro = new ResizeObserver(() => {
        if (!containerRef.current) return;
        chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
        syncCanvasSize();
      });
      ro.observe(containerRef.current);

      return () => { ro.disconnect(); chart.remove(); chartRef.current = null; seriesRef.current = null; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Sync canvas size to container ─────────────────────────────────────────
    const syncCanvasSize = useCallback(() => {
      const c = canvasRef.current, container = containerRef.current;
      if (!c || !container) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = container.clientWidth * dpr;
      c.height = container.clientHeight * dpr;
      c.style.width  = container.clientWidth  + "px";
      c.style.height = container.clientHeight + "px";
    }, []);
    useEffect(() => { syncCanvasSize(); }, [syncCanvasSize]);

    // ── Feed candle data ──────────────────────────────────────────────────────
    useEffect(() => {
      const s = seriesRef.current;
      if (!s || candles.length === 0) return;
      s.setData(candles.slice(0, currentBarIndex + 1).map((c) => ({
        time: c.time as Time, open: c.open, high: c.high, low: c.low, close: c.close,
      })));
      chartRef.current?.timeScale().scrollToPosition(10, false);
    }, [candles, currentBarIndex]);

    // ── Drawing div events (only fires when activeTool !== "none") ─────────────
    const getDivPos = (e: React.MouseEvent) => {
      const r = drawDivRef.current!.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const handleDrawMouseDown = (e: React.MouseEvent) => {
      const { x, y } = getDivPos(e);
      const tool = activeToolRef.current;

      // Single-click tools
      if (tool === "horizontal") {
        const p = toPrice(y); if (p === null) return;
        addDrawing({ id: uuidv4(), type: "horizontal", points: [{ time: 0, price: p }], color: colorRef.current, lineWidth: 1, lineStyle: "solid", locked: false });
        setActiveTool("none"); return;
      }
      if (tool === "vertical") {
        const t = toTime(x); if (t === null) return;
        addDrawing({ id: uuidv4(), type: "vertical", points: [{ time: t, price: 0 }], color: colorRef.current, lineWidth: 1, lineStyle: "solid", locked: false });
        setActiveTool("none"); return;
      }

      // Two-click tools
      const ds = drawState.current;
      if (!ds.active) {
        const t = toTime(x), p = toPrice(y);
        if (t !== null && p !== null) drawState.current = { active: true, p1: { time: t, price: p }, mx: x, my: y };
      } else {
        const t = toTime(x), p = toPrice(y);
        if (t !== null && p !== null && ds.p1) {
          addDrawing({ id: uuidv4(), type: tool as DrawingToolType, points: [ds.p1, { time: t, price: p }], color: colorRef.current, lineWidth: 1, lineStyle: "solid", locked: false });
          drawState.current = { active: false, p1: null, mx: 0, my: 0 };
          setActiveTool("none");
        }
      }
    };

    const handleDrawMouseMove = (e: React.MouseEvent) => {
      const { x, y } = getDivPos(e);
      drawState.current.mx = x;
      drawState.current.my = y;
    };

    // ── TP/SL drag handle events ──────────────────────────────────────────────
    const startDrag = (e: React.MouseEvent, tradeId: string, field: "stopLoss" | "takeProfit") => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = { tradeId, field };

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current || !containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const y = ev.clientY - rect.top;
        const p = toPrice(y);
        if (p !== null) updateTradeLevel(dragRef.current.tradeId, dragRef.current.field, Math.round(p * 100) / 100);
      };
      const onUp = () => { dragRef.current = null; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    // ── Escape key: cancel drawing ────────────────────────────────────────────
    useEffect(() => {
      const h = (e: KeyboardEvent) => {
        if (e.key === "Escape") { drawState.current = { active: false, p1: null, mx: 0, my: 0 }; setActiveTool("none"); }
      };
      window.addEventListener("keydown", h);
      return () => window.removeEventListener("keydown", h);
    }, [setActiveTool]);

    // ── Color change from toolbar ─────────────────────────────────────────────
    useEffect(() => {
      const h = (e: Event) => { colorRef.current = (e as CustomEvent).detail; };
      window.addEventListener("drawingColorChange", h);
      return () => window.removeEventListener("drawingColorChange", h);
    }, []);

    // ── Imperative handle ─────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      getChart: () => chartRef.current,
      takeScreenshot: () => chartRef.current?.takeScreenshot().toDataURL("image/png") ?? null,
    }));

    const openTrades = trades.filter((t) => t.status === "open");

    return (
      <div ref={containerRef} className="w-full h-full relative select-none">

        {/* Render-only canvas — pointer-events: none always */}
        <canvas ref={canvasRef} className="absolute inset-0 z-10" style={{ pointerEvents: "none" }} />

        {/* Drawing interaction div — mounted only when a tool is selected */}
        {activeTool !== "none" && (
          <div
            ref={drawDivRef}
            className="absolute inset-0 z-20 cursor-crosshair"
            onMouseDown={handleDrawMouseDown}
            onMouseMove={handleDrawMouseMove}
          />
        )}

        {/* TP/SL drag handles — always mounted, positioned via RAF loop */}
        {openTrades.map((trade) => (
          <div key={trade.id}>
            {trade.takeProfit !== null && (
              <div
                ref={(el) => { if (el) tpHandleRefs.current.set(trade.id, el); else tpHandleRefs.current.delete(trade.id); }}
                className="absolute z-30 left-0 right-0 h-4 cursor-ns-resize"
                style={{ top: 0 }}
                onMouseDown={(e) => startDrag(e, trade.id, "takeProfit")}
                title={`TP sürükle: ${trade.takeProfit.toFixed(2)}`}
              />
            )}
            {trade.stopLoss !== null && (
              <div
                ref={(el) => { if (el) slHandleRefs.current.set(trade.id, el); else slHandleRefs.current.delete(trade.id); }}
                className="absolute z-30 left-0 right-0 h-4 cursor-ns-resize"
                style={{ top: 0 }}
                onMouseDown={(e) => startDrag(e, trade.id, "stopLoss")}
                title={`SL sürükle: ${trade.stopLoss.toFixed(2)}`}
              />
            )}
          </div>
        ))}
      </div>
    );
  }
);

BacktestChart.displayName = "BacktestChart";
export default BacktestChart;

function hexToRgb(hex: string) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
}
