'use client';

import { useMemo, useState } from 'react';
import type { WeekBucket } from '@/lib/domain/views';
import { cn, formatDate } from '@/lib/utils';

const W = 720;
const H = 230;
const PAD = { top: 22, right: 8, bottom: 30, left: 34 };
const GAP = 2; // surface gap between stacked segments

function niceMax(v: number) {
  if (v <= 10) return 10;
  const step = v <= 40 ? 10 : v <= 100 ? 20 : 50;
  return Math.ceil(v / step) * step;
}

/** Rounded-top rect path (data end rounded, baseline square). */
function topRounded(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + rr} Q${x},${y} ${x + rr},${y} H${x + w - rr} Q${x + w},${y} ${x + w},${y + rr} V${y + h} Z`;
}

/**
 * Impacts per week, stacked practice + game, with alert-level weeks marked.
 * Hover (or focus) a column for exact values; "Table" shows the same data.
 */
export function WeeklyImpactsChart({ weeks }: { weeks: WeekBucket[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = useMemo(() => niceMax(Math.max(...weeks.map((w) => w.practice + w.game), 1)), [weeks]);

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(1, weeks.length);
  const barW = Math.min(44, slot * 0.62);
  const y = (v: number) => PAD.top + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const labelEvery = weeks.length > 14 ? 2 : 1;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Impacts per week</h2>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <Legend swatch="bg-chart-practice" label="Practice" />
          <Legend swatch="bg-chart-game" label="Game" />
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-alert ring-2 ring-alert/25" /> Alert-level hit
          </span>
          <button type="button" onClick={() => setTable((t) => !t)} className="no-print rounded-md border px-2 py-0.5 text-xs font-bold hover:bg-muted">
            {table ? 'Chart' : 'Table'}
          </button>
        </div>
      </div>

      {table ? (
        <div className="max-h-[260px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-1.5 font-semibold">Week of</th>
                <th className="py-1.5 text-right font-semibold">Practice</th>
                <th className="py-1.5 text-right font-semibold">Game</th>
                <th className="py-1.5 text-right font-semibold">Total</th>
                <th className="py-1.5 text-right font-semibold">Alert</th>
              </tr>
            </thead>
            <tbody className="tabular divide-y">
              {weeks.map((w) => (
                <tr key={w.weekStart}>
                  <td className="py-1.5">{formatDate(w.weekStart)}</td>
                  <td className="py-1.5 text-right">{w.practice}</td>
                  <td className="py-1.5 text-right">{w.game}</td>
                  <td className="py-1.5 text-right font-bold">{w.practice + w.game}</td>
                  <td className="py-1.5 text-right text-alert">{w.alert ? 'Yes' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Impacts per week, practice and game">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={t === 0 ? 1.5 : 1} />
                <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
                  {t}
                </text>
              </g>
            ))}
            {weeks.map((w, i) => {
              const cx = PAD.left + slot * i + slot / 2;
              const x = cx - barW / 2;
              const total = w.practice + w.game;
              const pTop = y(w.practice);
              const gTop = y(total);
              const pH = y(0) - pTop;
              const gH = pTop - gTop - (w.practice > 0 && w.game > 0 ? GAP : 0);
              const active = hover === i;
              return (
                <g
                  key={w.weekStart}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  tabIndex={0}
                  className="outline-none"
                >
                  <rect x={PAD.left + slot * i} y={PAD.top} width={slot} height={plotH} className={active ? 'fill-muted' : 'fill-transparent'} />
                  {w.practice > 0 ? (
                    <path
                      d={w.game > 0 ? `M${x},${pTop} H${x + barW} V${y(0)} H${x} Z` : topRounded(x, pTop, barW, pH, 4)}
                      className="fill-chart-practice"
                    />
                  ) : null}
                  {w.game > 0 && gH > 0 ? <path d={topRounded(x, gTop, barW, gH, 4)} className="fill-chart-game" /> : null}
                  {w.alert ? (
                    <g transform={`translate(${cx} ${Math.max(PAD.top - 6, gTop - 12)})`}>
                      <circle r="8" className="fill-card" />
                      <circle r="6.5" className="fill-alert/25" />
                      <circle r="4" className="fill-alert" />
                    </g>
                  ) : null}
                  {i % labelEvery === 0 ? (
                    <text x={cx} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                      {formatDate(w.weekStart)}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
          {hover !== null && weeks[hover] ? (
            <Tooltip week={weeks[hover]} leftPct={((PAD.left + slot * hover + slot / 2) / W) * 100} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-3 w-3 rounded-sm', swatch)} /> {label}
    </span>
  );
}

function Tooltip({ week, leftPct }: { week: WeekBucket; leftPct: number }) {
  const total = week.practice + week.game;
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 w-44 -translate-x-1/2 rounded-lg border bg-card p-2.5 text-xs shadow-lg"
      style={{ left: `clamp(88px, ${leftPct}%, calc(100% - 88px))` }}
    >
      <div className="mb-1 font-bold">Week of {formatDate(week.weekStart)}</div>
      <Row swatch="bg-chart-practice" label="Practice" value={week.practice} />
      <Row swatch="bg-chart-game" label="Game" value={week.game} />
      <div className="mt-1 flex justify-between border-t pt-1 font-bold">
        <span>Total</span>
        <span className="tabular">{total}</span>
      </div>
      {week.alert ? <div className="mt-1 font-bold text-alert">● Alert-level hit this week</div> : null}
    </div>
  );
}

function Row({ swatch, label, value }: { swatch: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <span className={cn('h-2.5 w-2.5 rounded-sm', swatch)} /> {label}
      </span>
      <span className="tabular font-semibold">{value}</span>
    </div>
  );
}
