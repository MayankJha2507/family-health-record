'use client';

import { useState } from 'react';
import type { MarkerSeries, ProfileTrends } from '@/lib/trends/build';

/* ---------- small helpers ---------- */
const fmt = (n: number | null) => (n == null ? '—' : Number.isInteger(n) ? String(n) : String(n));
const shortDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });

function rangeText(low: number | null, high: number | null): string {
  if (low != null && high != null) return `${low}–${high}`;
  if (high != null) return `< ${high}`;
  if (low != null) return `> ${low}`;
  return '—';
}

/* ---------- sparkline ---------- */
function Sparkline({ series, tone }: { series: MarkerSeries; tone: 'good' | 'bad' | 'neutral' }) {
  const vals = series.points.map((p) => p.value).filter((v): v is number => v != null);
  if (vals.length < 2) return <span className="faint small">—</span>;
  const w = 76, h = 24, pad = 3;
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((v - min) / span) * (h - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const stroke = tone === 'good' ? 'var(--flag-normal)' : tone === 'bad' ? 'var(--flag-high)' : 'var(--accent)';
  const last = pts[pts.length - 1].split(',');
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill={stroke} />
    </svg>
  );
}

/* ---------- expanded chart ---------- */
function ExpandedChart({ series }: { series: MarkerSeries }) {
  const pts = series.points.filter((p) => p.value != null);
  const w = 560, h = 220, padL = 44, padR = 16, padT = 18, padB = 34;
  const vals = pts.map((p) => p.value as number);
  const low = series.latest.ref_low, high = series.latest.ref_high;
  // Include the reference bounds in the y-domain so the normal band is always
  // visible, even when values sit well outside a single-sided range.
  const bounds = [low, high].filter((v): v is number => v != null);
  const lo = Math.min(...vals, ...bounds) * 0.96;
  const hi = Math.max(...vals, ...bounds) * 1.04;
  const span = hi - lo || 1;
  const x = (i: number) => padL + (pts.length === 1 ? 0.5 : i / (pts.length - 1)) * (w - padL - padR);
  const y = (v: number) => h - padB - ((v - lo) / span) * (h - padT - padB);

  return (
    <div className="chart-wrap">
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${series.display_name} trend`}>
        {/* lab range band */}
        {(low != null || high != null) && (
          <rect x={padL} width={w - padL - padR}
            y={y(high ?? hi)} height={Math.max(2, y(low ?? lo) - y(high ?? hi))}
            fill="var(--flag-normal-bg)" />
        )}
        {low != null && <line x1={padL} x2={w - padR} y1={y(low)} y2={y(low)} stroke="var(--flag-normal)" strokeDasharray="3 3" strokeWidth="1" opacity="0.6" />}
        {high != null && <line x1={padL} x2={w - padR} y1={y(high)} y2={y(high)} stroke="var(--flag-normal)" strokeDasharray="3 3" strokeWidth="1" opacity="0.6" />}
        {/* value line */}
        {pts.length >= 2 && (
          <polyline points={pts.map((p, i) => `${x(i)},${y(p.value as number)}`).join(' ')}
            fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        )}
        {/* points + value labels */}
        {pts.map((p, i) => {
          const abn = p.flag === 'high' || p.flag === 'low' || p.flag === 'abnormal';
          return (
            <g key={i}>
              <circle cx={x(i)} cy={y(p.value as number)} r="4" fill={abn ? 'var(--flag-high)' : 'var(--accent)'} />
              <text x={x(i)} y={y(p.value as number) - 9} textAnchor="middle" className="chart-val">{fmt(p.value)}</text>
              <text x={x(i)} y={h - 12} textAnchor="middle" className="chart-axis">{shortDate(p.date)}</text>
            </g>
          );
        })}
        <text x={w - padR} y={y(high ?? hi) - 4} textAnchor="end" className="chart-axis">lab range</text>
      </svg>
      <p className="faint small" style={{ margin: '2px 0 0' }}>Shaded band = your lab&apos;s printed normal range. Values in {series.unit}.</p>
    </div>
  );
}

/* ---------- marker row ---------- */
function MarkerRow({ series, tone, showChange }: { series: MarkerSeries; tone: 'good' | 'bad' | 'neutral'; showChange: boolean }) {
  const [open, setOpen] = useState(false);
  const canExpand = series.points.filter((p) => p.value != null).length >= 2;
  const dir = series.changePct == null ? null : series.changePct > 0 ? '↑' : series.changePct < 0 ? '↓' : '→';

  return (
    <div className={`marker ${canExpand ? 'marker-clickable' : ''}`}>
      <div className="marker-row" onClick={() => canExpand && setOpen((o) => !o)}>
        <div className="marker-name">
          {series.core && <span className="core-dot" title="Core marker" />}
          {series.display_name}
        </div>
        <div className="marker-val numeric">
          {fmt(series.latest.value)} <span className="faint">{series.unit}</span>
        </div>
        <div className="marker-range numeric faint small">{rangeText(series.latest.ref_low, series.latest.ref_high)}</div>
        <div className="marker-flag">
          {series.abnormal ? (
            <span className={`flag ${series.latest.flag}`}>{series.latest.flag}</span>
          ) : showChange && series.changed && dir ? (
            <span className={`chg chg-${tone}`}>{dir} {Math.abs(series.changePct!).toFixed(0)}%</span>
          ) : (
            <span className="flag normal">in range</span>
          )}
        </div>
        <div className="marker-spark">
          {canExpand ? <Sparkline series={series} tone={tone} /> : <span className="faint small">one reading</span>}
        </div>
      </div>
      {open && canExpand && <ExpandedChart series={series} />}
    </div>
  );
}

/* ---------- collapsible section ---------- */
function Section({ title, subtitle, defaultOpen, children }: { title: string; subtitle?: string; defaultOpen: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card trend-section">
      <button className="section-head" onClick={() => setOpen((o) => !o)}>
        <span className="chevron">{open ? '▾' : '▸'}</span>
        <span className="section-title">{title}</span>
        {subtitle && <span className="section-sub muted small">{subtitle}</span>}
      </button>
      {open && <div className="section-body">{children}</div>}
    </div>
  );
}

/* ---------- main view ---------- */
export function TrendsView({ trends }: { trends: ProfileTrends }) {
  return (
    <div className="stack">
      {/* 1. Attention */}
      {trends.attention.length > 0 ? (
        <div className="card trend-section attention">
          <div className="section-head static">
            <span className="section-title">Worth a closer look</span>
            <span className="section-sub muted small">{trends.attention.length} outside the lab&apos;s range</span>
          </div>
          <div className="section-body">
            {trends.attention.map((s) => <MarkerRow key={s.code} series={s} tone="neutral" showChange={false} />)}
            <p className="disclaimer-inline small">
              Outside the lab&apos;s printed range doesn&apos;t mean something is wrong — <strong>discuss these with your doctor</strong>.
            </p>
          </div>
        </div>
      ) : (
        <div className="card all-clear">
          <span className="all-clear-dot" /> All values are within your lab&apos;s ranges.
        </div>
      )}

      {/* 2. Recently changed */}
      {trends.recentlyChanged.length > 0 && (
        <Section title="Recently changed" subtitle={`${trends.recentlyChanged.length} moved since last test, still in range`} defaultOpen>
          {trends.recentlyChanged.map((s) => (
            <MarkerRow key={s.code} series={s} tone={s.changeQuality === 'good' ? 'good' : s.changeQuality === 'bad' ? 'bad' : 'neutral'} showChange />
          ))}
        </Section>
      )}

      {/* 3. By panel (collapsed) */}
      {trends.byPanel.map((panel) => {
        const abn = panel.markers.filter((m) => m.abnormal).length;
        const summary = abn > 0 ? `${panel.markers.length} markers · ${abn} to review` : `${panel.markers.length} markers · all in range`;
        return (
          <Section key={panel.category} title={panel.category} subtitle={summary} defaultOpen={false}>
            <div className="marker-head">
              <span>Marker</span><span>Latest</span><span>Lab range</span><span>Status</span><span>Trend</span>
            </div>
            {panel.markers.map((s) => <MarkerRow key={s.code} series={s} tone="neutral" showChange={false} />)}
          </Section>
        );
      })}

      {/* 4. Found but not trended */}
      {trends.untracked.length > 0 && (
        <Section title="Found but not trended" subtitle={`${trends.untracked.length} analyte(s) not in our dictionary yet`} defaultOpen={false}>
          <p className="faint small" style={{ marginTop: 0 }}>
            We stored these exactly as printed but don&apos;t chart them yet, so nothing is silently dropped.
          </p>
          {trends.untracked.map((u, i) => (
            <div className="marker-row" key={i}>
              <div className="marker-name">{u.raw_name}</div>
              <div className="marker-val numeric">{fmt(u.value)} <span className="faint">{u.unit ?? ''}</span></div>
              <div /><div /><div className="faint small">{shortDate(u.date)}</div>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}
