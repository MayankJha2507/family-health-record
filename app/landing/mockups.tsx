/**
 * Marketing mockups — self-contained "product screenshots" rendered from the
 * FICTIONAL sample-data. No imports from the app, no real data, no pipeline.
 * These are illustrations of the product, styled with the shared design tokens.
 */
import { SERIES, MOCK_DATES, MOCK_FAMILY, latest, type MockSeries } from './sample-data';

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(1))));

/** Browser-window chrome around a mockup, so it reads as a screenshot. */
export function Frame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <figure className="mock-frame" role="img" aria-label={`Product screenshot: ${label}`}>
      <div className="mock-bar" aria-hidden>
        <span className="mock-dot" /><span className="mock-dot" /><span className="mock-dot" />
        <span className="mock-url">familyvitals.app</span>
      </div>
      <div className="mock-body">{children}</div>
    </figure>
  );
}

function Sparkline({ s, tone }: { s: MockSeries; tone: 'good' | 'bad' | 'neutral' }) {
  const v = s.points, w = 72, h = 22, pad = 2;
  const min = Math.min(...v), max = Math.max(...v), span = max - min || 1;
  const pts = v.map((val, i) => `${(pad + (i / (v.length - 1)) * (w - 2 * pad)).toFixed(1)},${(h - pad - ((val - min) / span) * (h - 2 * pad)).toFixed(1)}`);
  const stroke = tone === 'good' ? 'var(--flag-normal)' : tone === 'bad' ? 'var(--flag-high)' : 'var(--accent)';
  const [lx, ly] = pts[pts.length - 1].split(',');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2.4" fill={stroke} />
    </svg>
  );
}

/* ---------- 1. Triage view ---------- */
export function TriageMock() {
  const attention: [MockSeries, 'down' | 'up'][] = [[SERIES.ldl, 'down'], [SERIES.tsh, 'up']];
  const changed: MockSeries[] = [SERIES.vitaminD, SERIES.triglycerides];
  return (
    <div className="mk mk-triage">
      <div className="mk-attn">
        <div className="mk-attn-head"><strong>Worth a closer look</strong><span className="mk-sub">2 to discuss</span></div>
        {attention.map(([s, dir]) => {
          const l = latest(s);
          return (
            <div className="mk-row" key={s.name}>
              <span className="mk-name">{s.name}</span>
              <span className="mk-val">{fmt(l.v)}<span className="mk-unit"> {s.unit}</span></span>
              <span className="mk-range">{s.rangeLabel}</span>
              <span className="mk-flag high">{dir === 'up' ? '↑ ' : '↓ '}high</span>
              <Sparkline s={s} tone="neutral" />
            </div>
          );
        })}
        <p className="mk-note">Outside your lab’s range — worth discussing with your doctor.</p>
      </div>
      <div className="mk-section-title">Recently changed</div>
      {changed.map((s) => {
        const l = latest(s);
        return (
          <div className="mk-row" key={s.name}>
            <span className="mk-name">{s.name}</span>
            <span className="mk-val">{fmt(l.v)}<span className="mk-unit"> {s.unit}</span></span>
            <span className="mk-range">{s.rangeLabel}</span>
            <span className={`mk-chg ${l.quality}`}>{l.changePct > 0 ? '↑' : '↓'} {Math.abs(l.changePct).toFixed(0)}%</span>
            <Sparkline s={s} tone={l.quality} />
          </div>
        );
      })}
      <div className="mk-panel-row"><span>Thyroid</span><span className="mk-sub">4 markers · 1 outside range</span></div>
    </div>
  );
}

/* ---------- 2. Trend chart with reference band ---------- */
export function TrendMock({ seriesKey }: { seriesKey: keyof typeof SERIES }) {
  const s = SERIES[seriesKey];
  const l = latest(s);
  const w = 460, h = 230, padL = 40, padR = 18, padT = 24, padB = 34;
  const bounds = [s.refLow, s.refHigh].filter((x): x is number => x != null);
  const lo = Math.min(...s.points, ...bounds) * 0.9;
  const hi = Math.max(...s.points, ...bounds) * 1.08;
  const span = hi - lo || 1;
  const x = (i: number) => padL + (i / (s.points.length - 1)) * (w - padL - padR);
  const y = (v: number) => h - padB - ((v - lo) / span) * (h - padT - padB);
  const bandTop = y(s.refHigh ?? hi), bandBot = y(s.refLow ?? lo);
  const improving = l.quality === 'good';

  return (
    <div className="mk mk-trend">
      <div className="mk-trend-head">
        <div>
          <div className="mk-name lg">{s.name}</div>
          <div className="mk-sub">Feb 2026 · latest {fmt(l.v)} {s.unit}</div>
        </div>
        <span className={`mk-chg ${improving ? 'good' : l.quality}`}>
          {l.changePct > 0 ? '↑' : '↓'} {Math.abs(((s.points[s.points.length - 1] - s.points[0]) / s.points[0]) * 100).toFixed(0)}% over the year
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${s.name} trend`}>
        {(s.refLow != null || s.refHigh != null) && (
          <rect x={padL} y={bandTop} width={w - padL - padR} height={Math.max(2, bandBot - bandTop)} fill="var(--flag-normal-bg)" />
        )}
        {s.refHigh != null && <line x1={padL} x2={w - padR} y1={y(s.refHigh)} y2={y(s.refHigh)} stroke="var(--flag-normal)" strokeDasharray="3 3" strokeWidth="1" opacity="0.55" />}
        {s.refLow != null && <line x1={padL} x2={w - padR} y1={y(s.refLow)} y2={y(s.refLow)} stroke="var(--flag-normal)" strokeDasharray="3 3" strokeWidth="1" opacity="0.55" />}
        <polyline points={s.points.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        {s.points.map((v, i) => {
          const last = i === s.points.length - 1;
          const out = (s.refHigh != null && v > s.refHigh) || (s.refLow != null && v < s.refLow);
          const concern = out && !((s.direction === 'higher-better' && v > (s.refHigh ?? Infinity)) || (s.direction === 'lower-better' && v < (s.refLow ?? -Infinity)));
          return (
            <g key={i}>
              <circle cx={x(i)} cy={y(v)} r={last ? 4.5 : 3} fill={last && concern ? 'var(--flag-high)' : 'var(--accent)'} />
              {last && <text x={x(i)} y={y(v) - 10} textAnchor="middle" className="mk-chart-val">{fmt(v)}</text>}
              <text x={x(i)} y={h - 12} textAnchor="middle" className="mk-chart-axis">{MOCK_DATES[i]}</text>
            </g>
          );
        })}
        <text x={w - padR} y={bandTop - 4} textAnchor="end" className="mk-chart-axis">normal range</text>
      </svg>
    </div>
  );
}

/* ---------- 3. Family multi-profile ---------- */
export function FamilyMock() {
  return (
    <div className="mk mk-family">
      <div className="mk-family-head"><strong>Your family</strong><span className="mk-sub">3 members</span></div>
      {MOCK_FAMILY.map((m) => (
        <div className="mk-family-row" key={m.name}>
          <div className="mk-avatar" aria-hidden>{m.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}</div>
          <div className="mk-family-name"><strong>{m.name}</strong><span className="mk-sub"> {m.meta}</span></div>
          <span className={`mk-pill ${m.tone}`}>{m.status}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- 4. Doctor summary ---------- */
export function SummaryMock() {
  const rows = [
    { s: SERIES.hba1c, cells: ['7.6', '6.8', '6.2'], concern: true },
    { s: SERIES.ldl, cells: ['168', '141', '122'], concern: true },
    { s: SERIES.vitaminD, cells: ['16', '29', '39'], concern: false, low: true },
    { s: SERIES.hdl, cells: ['62', '66', '70'], concern: false },
  ];
  const cols = ['Mar 25', 'Sep 25', 'Feb 26'];
  return (
    <div className="mk mk-summary">
      <div className="mk-doc-head">
        <div><div className="mk-doc-brand">Family Vitals · Blood-test summary</div><div className="mk-doc-name">Meera Nair</div><div className="mk-sub">self · 52y · female</div></div>
        <div className="mk-sub" style={{ textAlign: 'right' }}>Prepared 17 Feb 2026<br />5 reports</div>
      </div>
      <div className="mk-doc-disc">Patient-prepared summary — not a diagnosis. H/L = outside the lab’s range.</div>
      <table className="mk-doc-table">
        <thead><tr><th className="tl">Marker</th><th className="tl">Range</th>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map(({ s, cells, concern, low }) => (
            <tr key={s.name}>
              <td className="tl">{s.name}</td>
              <td className="tl mk-sub">{s.rangeLabel}</td>
              {cells.map((c, i) => {
                const isLast = i === cells.length - 1;
                const flag = low ? (Number(c) < (s.refLow ?? 0) ? 'L' : '') : (s.refHigh != null && Number(c) > s.refHigh ? 'H' : '');
                return <td key={i} className={concern && isLast && flag ? 'mk-cell-concern' : ''}>{c}{flag && <sup>{flag}</sup>}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
