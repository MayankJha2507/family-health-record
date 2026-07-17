import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { buildProfileTrends, isConcerning, type ResultRow, type MarkerSeries, type TrendPoint } from '@/lib/trends/build';
import { PrintButton } from './print-button';

/* ---------- display helpers (shared shape with the trends view) ---------- */
function displayValue(n: number | null): string {
  if (n == null) return '—';
  const a = Math.abs(n);
  const dec = a >= 10 ? 0 : a >= 1 ? 1 : 2;
  return String(Number(n.toFixed(dec)));
}
const longDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const colDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });

function rangeLabel(p: TrendPoint): string {
  if (p.ref_low != null && p.ref_high != null) return `${displayValue(p.ref_low)}–${displayValue(p.ref_high)}`;
  if (p.ref_high != null) return `< ${displayValue(p.ref_high)}`;
  if (p.ref_low != null) return `> ${displayValue(p.ref_low)}`;
  if (p.ref_text && p.ref_text.trim()) return p.ref_text.trim().length > 24 ? p.ref_text.trim().slice(0, 23) + '…' : p.ref_text.trim();
  return '—';
}

function ageFromDob(dob: string | null): string {
  if (!dob) return '';
  const d = new Date(dob), now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a >= 0 && a < 130 ? `${a}y` : '';
}

/** Server-rendered mini sparkline (SVG prints fine, no client JS). */
function Spark({ series }: { series: MarkerSeries }) {
  const vals = series.points.map((p) => p.value).filter((v): v is number => v != null);
  if (vals.length < 2) return <span className="faint">—</span>;
  const w = 64, h = 18, pad = 2;
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = pad + (i / (vals.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((v - min) / span) * (h - 2 * pad);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="doc-spark" aria-hidden>
      <polyline points={pts.join(' ')} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Flag letter for a value at a given date, standard lab convention (H/L). */
function cellFlag(point: TrendPoint | undefined, direction: MarkerSeries['direction']) {
  if (!point) return { text: '', concern: false };
  const letter = point.flag === 'high' ? 'H' : point.flag === 'low' ? 'L' : '';
  return { text: letter, concern: isConcerning(point.flag, direction) };
}

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles').select('id, name, relation, dob, sex').eq('id', id).single();
  if (!profile) {
    return <main className="container"><div className="card"><h3>Profile not found</h3><Link href="/" className="link">← Family</Link></div></main>;
  }

  const { data: rowsRaw } = await supabase
    .from('results')
    .select('raw_name, value, canonical_value, canonical_unit, unit, ref_low, ref_high, ref_text, flag, measured_at, biomarkers(code)')
    .eq('profile_id', id)
    .order('measured_at', { ascending: true });

  const rows: ResultRow[] = (rowsRaw ?? []).map((r) => ({
    code: (r.biomarkers as { code?: string } | null)?.code ?? null,
    raw_name: r.raw_name, value: r.value, canonical_value: r.canonical_value,
    canonical_unit: r.canonical_unit, unit: r.unit, ref_low: r.ref_low, ref_high: r.ref_high,
    ref_text: r.ref_text, flag: r.flag, measured_at: r.measured_at,
  }));
  const trends = buildProfileTrends(rows, 0);

  // Distinct report dates → columns of the longitudinal grid (chronological).
  const dates = [...new Set(trends.series.flatMap((s) => s.points.map((p) => p.date)))].sort();
  const pointAt = (s: MarkerSeries, date: string) => s.points.find((p) => p.date === date);

  const meta = [profile.relation, ageFromDob(profile.dob), profile.sex].filter(Boolean).join(' · ');
  const preparedOn = longDate(new Date().toISOString().slice(0, 10));

  if (rows.length === 0) {
    return (
      <main className="container">
        <div className="card"><h3 style={{ marginTop: 0 }}>Nothing to summarize yet</h3>
          <p className="muted">Confirm a report for {profile.name} first.</p>
          <Link href={`/profiles/${id}`} className="link">← Back</Link></div>
      </main>
    );
  }

  return (
    <main className="container summary-doc">
      <div className="between no-print" style={{ marginBottom: 'var(--sp-4)' }}>
        <Link href={`/profiles/${id}`} className="link">← Back to {profile.name}</Link>
        <PrintButton />
      </div>

      {/* Document header */}
      <header className="doc-head">
        <div>
          <div className="doc-brand">Family Vitals · Blood-test summary</div>
          <h1 className="doc-name">{profile.name}</h1>
          {meta && <div className="doc-meta">{meta}</div>}
        </div>
        <div className="doc-head-right small">
          <div>Prepared <strong>{preparedOn}</strong></div>
          <div className="faint">{dates.length} report{dates.length === 1 ? '' : 's'} · {colDate(dates[0])} – {colDate(dates[dates.length - 1])}</div>
        </div>
      </header>

      <p className="doc-disclaimer">
        Patient-prepared summary of lab results — <strong>not a diagnosis</strong>. Values flagged
        <span className="mono"> H</span>/<span className="mono">L</span> fall outside the lab&apos;s printed range; bold flags are in an
        unfavourable direction. Please interpret in clinical context.
      </p>

      {/* Attention line */}
      {trends.attention.length > 0 && (
        <div className="doc-attention">
          <strong>Outside range, worth discussing:</strong>{' '}
          {trends.attention.map((s, i) => (
            <span key={s.code}>{i > 0 ? ', ' : ''}{s.display_name} ({displayValue(s.latest.value)} {s.unit})</span>
          ))}
        </div>
      )}

      {/* Per-panel longitudinal grids */}
      {trends.byPanel.map((panel) => (
        <section key={panel.category} className="doc-panel">
          <h2 className="doc-panel-title">{panel.category}</h2>
          <table className="doc-table">
            <thead>
              <tr>
                <th className="tl">Marker</th>
                <th className="tl">Lab range</th>
                {dates.map((d) => <th key={d}>{colDate(d)}</th>)}
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              {panel.markers.map((s) => (
                <tr key={s.code}>
                  <td className="tl marker-cell">{s.display_name}{s.core && <span className="doc-core" title="core marker"> ●</span>}</td>
                  <td className="tl faint numeric">{rangeLabel(s.latest)}</td>
                  {dates.map((d) => {
                    const p = pointAt(s, d);
                    const f = cellFlag(p, s.direction);
                    return (
                      <td key={d} className="numeric">
                        {p ? (
                          <span className={f.concern ? 'cell-concern' : undefined}>
                            {displayValue(p.value)}{f.text && <sup className="cell-flag">{f.text}</sup>}
                          </span>
                        ) : <span className="faint">·</span>}
                      </td>
                    );
                  })}
                  <td className="doc-spark-cell">{<Spark series={s} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {/* Untracked */}
      {trends.untracked.length > 0 && (
        <section className="doc-panel">
          <h2 className="doc-panel-title">Other results (not standardized)</h2>
          <p className="faint small" style={{ margin: '0 0 6px' }}>Captured as printed; shown for completeness.</p>
          <table className="doc-table">
            <tbody>
              {trends.untracked.map((u, i) => (
                <tr key={i}><td className="tl marker-cell">{u.raw_name}</td><td className="numeric">{displayValue(u.value)} {u.unit ?? ''}</td><td className="faint numeric">{colDate(u.date)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Notes for the doctor */}
      <section className="doc-notes">
        <h2 className="doc-panel-title">Notes</h2>
        <div className="doc-note-lines" aria-hidden><span /><span /><span /></div>
      </section>

      <footer className="doc-foot small faint">
        Generated by Family Vitals — a personal record-keeping tool. It does not diagnose or
        recommend treatment. Discuss any out-of-range value with your doctor.
      </footer>
    </main>
  );
}
