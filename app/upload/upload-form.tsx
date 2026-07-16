'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Profile {
  id: string;
  name: string;
  relation: string | null;
}

type Phase = 'idle' | 'uploading' | 'processing' | 'needs_review' | 'failed';

/**
 * 2a upload + 2b trigger, client side:
 *   1. upload the PDF to {userId}/{reportId}.pdf in the private bucket (RLS)
 *   2. insert a reports row (status=processing) (RLS)
 *   3. POST the pipeline trigger, then poll the row until needs_review/failed
 * No results are written here — the pipeline produces a draft to review.
 */
export function UploadForm({ userId, profiles }: { userId: string; profiles: Profile[] }) {
  const supabase = createClient();
  const router = useRouter();

  const [profileId, setProfileId] = useState(profiles[0]?.id ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);

  const busy = phase === 'uploading' || phase === 'processing';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !profileId) return;
    setMessage(null);

    const id = crypto.randomUUID();
    const path = `${userId}/${id}.pdf`;

    // 1. Upload to the proven-private bucket.
    setPhase('uploading');
    const up = await supabase.storage.from('reports').upload(path, file, {
      contentType: 'application/pdf',
      upsert: false,
    });
    if (up.error) {
      setPhase('failed');
      setMessage(`Upload failed: ${up.error.message}`);
      return;
    }

    // 2. Insert the reports row (owner-gated; status=processing).
    const ins = await supabase.from('reports').insert({
      id,
      profile_id: profileId,
      storage_path: path,
      status: 'processing',
    });
    if (ins.error) {
      setPhase('failed');
      setMessage(`Could not create report: ${ins.error.message}`);
      return;
    }
    setReportId(id);

    // 3. Trigger the pipeline, then poll status.
    setPhase('processing');
    const res = await fetch(`/api/reports/${id}/process`, { method: 'POST' });
    if (!res.ok && res.status !== 422) {
      // fall through to polling anyway — the row is source of truth
    }
    await pollUntilDone(id);
  }

  async function pollUntilDone(id: string) {
    for (let i = 0; i < 90; i++) {
      const { data } = await supabase
        .from('reports')
        .select('status')
        .eq('id', id)
        .single();
      if (data?.status === 'needs_review') {
        setPhase('needs_review');
        return;
      }
      if (data?.status === 'failed') {
        setPhase('failed');
        setMessage('Extraction failed. You can delete this upload and try again, or enter values manually.');
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    setMessage('Still processing — check back on this report shortly.');
  }

  return (
    <form className="card stack" onSubmit={onSubmit}>
      <label className="field">
        <span className="label">Family member</span>
        <select
          className="select"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          disabled={busy}
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}{p.relation ? ` · ${p.relation}` : ''}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="label">Blood-test PDF</span>
        <input
          className="input"
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={busy}
        />
        <span className="small faint" style={{ display: 'block', marginTop: 'var(--sp-2)' }}>
          From any Indian diagnostic lab. Nothing is saved to your health record until you review and confirm it.
        </span>
      </label>

      {phase === 'idle' || phase === 'failed' ? (
        <button className="btn" type="submit" disabled={!file || !profileId}>
          Upload &amp; extract
        </button>
      ) : null}

      {(phase === 'uploading' || phase === 'processing') && (
        <div className="row" aria-live="polite">
          <span className="spinner" />
          <span className="muted">
            {phase === 'uploading' ? 'Uploading securely…' : 'Reading the report… this can take up to a minute.'}
          </span>
        </div>
      )}

      {phase === 'needs_review' && (
        <div className="row between" aria-live="polite">
          <span className="pill needs_review"><span className="dot" />Ready to review</span>
          <button
            type="button"
            className="btn"
            onClick={() => router.push(`/reports/${reportId}/review`)}
          >
            Review extracted values →
          </button>
        </div>
      )}

      {message && <p className="small" style={{ color: 'var(--flag-high)' }}>{message}</p>}
    </form>
  );
}
