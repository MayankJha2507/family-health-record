'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { confirmReport } from './actions';

export interface ReviewRow {
  biomarker_id: string | null;
  raw_name: string;
  value: number | null;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  ref_text: string | null;
  flag: string | null;
  entered_manually: boolean;
}

interface DictItem {
  code: string;
  display_name: string;
  category: string;
  canonical_unit: string;
}

/** Live preview flag; the authoritative flag is re-derived server-side on confirm. */
function previewFlag(value: number | null, low: number | null, high: number | null): string | null {
  if (value == null) return null;
  if (low != null && value < low) return 'low';
  if (high != null && value > high) return 'high';
  if (low != null || high != null) return 'normal';
  return null;
}

const numOrNull = (s: string): number | null => (s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s));

export function ReviewClient(props: {
  reportId: string;
  profileName: string;
  status: string;
  alreadyConfirmed: boolean;
  labName: string;
  collectedAt: string;
  pdfUrl: string | null;
  initialRows: ReviewRow[];
  dictionary: DictItem[];
}) {
  const [rows, setRows] = useState<ReviewRow[]>(props.initialRows);
  const [labName, setLabName] = useState(props.labName);
  const [collectedAt, setCollectedAt] = useState(props.collectedAt);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Confirmed reports open READ-ONLY (seeded from the confirmed results, not the
  // raw draft) — editing is a deliberate act, so re-review can't silently revert.
  const [editing, setEditing] = useState(!props.alreadyConfirmed);
  const ro = !editing;

  const dictByCode = new Map(props.dictionary.map((d) => [d.code, d]));

  function update(i: number, patch: Partial<ReviewRow>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function addRow() {
    setRows((rs) => [
      ...rs,
      { biomarker_id: null, raw_name: '', value: null, unit: null, ref_low: null, ref_high: null, ref_text: null, flag: null, entered_manually: true },
    ]);
  }
  function removeRow(i: number) {
    setRows((rs) => rs.filter((_, j) => j !== i));
  }

  function onConfirm() {
    setError(null);
    if (!collectedAt) {
      setError('Please set the collection date — it determines where this sits on the trend.');
      return;
    }
    startTransition(async () => {
      const res = await confirmReport({
        reportId: props.reportId,
        lab_name: labName || null,
        collected_at: collectedAt || null,
        rows: rows.map((r) => ({
          biomarker_id: r.biomarker_id,
          raw_name: r.raw_name,
          value: r.value,
          unit: r.unit,
          ref_low: r.ref_low,
          ref_high: r.ref_high,
          ref_text: r.ref_text,
          entered_manually: r.entered_manually,
        })),
      });
      if (res && !res.ok) setError(res.error);
    });
  }

  const trackedCount = rows.filter((r) => r.biomarker_id).length;

  return (
    <main className="container-wide">
      <div className="between" style={{ marginBottom: 'var(--sp-4)' }}>
        <div>
          <div className="eyebrow">Review &amp; confirm</div>
          <h1 style={{ marginBottom: 2 }}>{props.profileName ? `${props.profileName}'s report` : 'Review report'}</h1>
          <p className="muted small" style={{ margin: 0 }}>
            {props.alreadyConfirmed && ro
              ? 'Confirmed. These are the values saved to the record — edit only if you need to correct one.'
              : 'Check the extracted values against the PDF. Nothing is saved to the health record until you confirm.'}
          </p>
        </div>
        <Link href="/" className="link">← Family</Link>
      </div>

      <div className="review-split">
        {/* Original PDF */}
        <div className="card review-pdf">
          {props.pdfUrl ? (
            <iframe title="Original report" src={props.pdfUrl} className="pdf-frame" />
          ) : (
            <p className="muted">No PDF attached (manual entry).</p>
          )}
        </div>

        {/* Editable draft */}
        <div className={ro ? 'ro-view' : undefined}>
          <div className="card stack" style={{ marginBottom: 'var(--sp-4)' }}>
            <div className="row" style={{ gap: 'var(--sp-4)', alignItems: 'flex-end' }}>
              <label className="field" style={{ flex: 1, marginBottom: 0 }}>
                <span className="label">Collection date <span style={{ color: 'var(--flag-high)' }}>*</span></span>
                <input className="input" type="date" value={collectedAt} disabled={ro} onChange={(e) => setCollectedAt(e.target.value)} />
                <span className="small faint" style={{ display: 'block', marginTop: 4 }}>
                  Determines this report&apos;s place on the trend — not the upload order.
                </span>
              </label>
              <label className="field" style={{ flex: 1, marginBottom: 0 }}>
                <span className="label">Lab</span>
                <input className="input" value={labName} disabled={ro} onChange={(e) => setLabName(e.target.value)} placeholder="e.g. Thyrocare" />
              </label>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="review-th">
              <span>Test &amp; mapping</span>
              <span>Value</span>
              <span>Range</span>
              <span>Flag</span>
              <span />
            </div>

            {rows.map((r, i) => {
              const flag = previewFlag(r.value, r.ref_low, r.ref_high);
              const tracked = !!r.biomarker_id;
              const dict = r.biomarker_id ? dictByCode.get(r.biomarker_id) : undefined;
              return (
                <div className="review-tr" key={i}>
                  <div className="stack-tight">
                    <input
                      className="input input-sm"
                      value={r.raw_name}
                      disabled={ro}
                      placeholder="Test name (as printed)"
                      onChange={(e) => update(i, { raw_name: e.target.value })}
                    />
                    <select
                      className="select select-sm"
                      value={r.biomarker_id ?? ''}
                      disabled={ro}
                      onChange={(e) => {
                        const code = e.target.value || null;
                        const d = code ? dictByCode.get(code) : undefined;
                        update(i, { biomarker_id: code, unit: r.unit ?? d?.canonical_unit ?? null });
                      }}
                      style={{ color: tracked ? 'var(--text)' : 'var(--text-faint)' }}
                    >
                      <option value="">— Not tracked —</option>
                      {props.dictionary.map((d) => (
                        <option key={d.code} value={d.code}>{d.display_name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="row" style={{ gap: 4 }}>
                    <input
                      className="input input-sm numeric"
                      style={{ width: 74 }}
                      inputMode="decimal"
                      value={r.value ?? ''}
                      disabled={ro}
                      onChange={(e) => update(i, { value: numOrNull(e.target.value) })}
                    />
                    <input
                      className="input input-sm"
                      style={{ width: 66 }}
                      value={r.unit ?? ''}
                      disabled={ro}
                      placeholder={dict?.canonical_unit ?? 'unit'}
                      onChange={(e) => update(i, { unit: e.target.value || null })}
                    />
                  </div>

                  <div className="row" style={{ gap: 4 }}>
                    <input
                      className="input input-sm numeric" style={{ width: 58 }} placeholder="low" disabled={ro}
                      value={r.ref_low ?? ''} onChange={(e) => update(i, { ref_low: numOrNull(e.target.value) })}
                    />
                    <span className="faint">–</span>
                    <input
                      className="input input-sm numeric" style={{ width: 58 }} placeholder="high" disabled={ro}
                      value={r.ref_high ?? ''} onChange={(e) => update(i, { ref_high: numOrNull(e.target.value) })}
                    />
                  </div>

                  <div>{flag ? <span className={`flag ${flag}`}>{flag}</span> : <span className="faint small">—</span>}</div>

                  {editing ? (
                    <button type="button" className="row-remove" onClick={() => removeRow(i)} aria-label="Remove row">×</button>
                  ) : <span />}
                </div>
              );
            })}

            {editing && (
              <div style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addRow}>+ Add a row / manual entry</button>
              </div>
            )}
          </div>

          <div className="between" style={{ marginTop: 'var(--sp-4)' }}>
            <span className="muted small">
              {rows.length} row(s) · {trackedCount} tracked ·{' '}
              {rows.length - trackedCount} not tracked
            </span>
            {ro ? (
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>Edit values</button>
            ) : (
              <button type="button" className="btn" onClick={onConfirm} disabled={pending}>
                {pending ? 'Saving…' : props.alreadyConfirmed ? 'Save changes' : 'Confirm & save to record'}
              </button>
            )}
          </div>
          {error && <p className="small" style={{ color: 'var(--flag-high)', textAlign: 'right' }}>{error}</p>}
        </div>
      </div>
    </main>
  );
}
