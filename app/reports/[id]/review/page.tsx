import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { normalizeExtraction } from '@/lib/pipeline/normalize';
import { BIOMARKERS } from '@/lib/biomarkers/dictionary';
import type { RawExtraction } from '@/lib/pipeline/types';
import { ReviewClient, type ReviewRow } from './review-client';

/**
 * 2c review screen (server side): load the draft (raw_extraction), normalize it
 * for display, sign a URL for the original PDF, and hand off to the editable
 * client. Nothing here writes results — that only happens on confirm.
 */
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: report } = await supabase
    .from('reports')
    .select('id, status, lab_name, collected_at, storage_path, raw_extraction, profiles(name)')
    .eq('id', id)
    .single();

  if (!report) {
    return (
      <main className="container">
        <div className="card"><h3>Report not found</h3><Link href="/" className="link">← Back to family</Link></div>
      </main>
    );
  }

  // Sign a short-lived URL for the original PDF (private bucket).
  let pdfUrl: string | null = null;
  if (report.storage_path) {
    const { data: signed } = await supabase.storage.from('reports').createSignedUrl(report.storage_path, 3600);
    pdfUrl = signed?.signedUrl ?? null;
  }

  // Normalize the draft transcription into editable rows.
  const raw = (report.raw_extraction ?? { results: [] }) as RawExtraction;
  const normalized = normalizeExtraction(raw);
  const rows: ReviewRow[] = normalized.map((r) => ({
    biomarker_id: r.biomarker_id,
    raw_name: r.raw_name,
    value: r.value,
    unit: r.unit,
    ref_low: r.ref_low,
    ref_high: r.ref_high,
    ref_text: r.ref_text,
    flag: r.flag,
    entered_manually: false,
  }));

  const dictionary = BIOMARKERS.map((b) => ({
    code: b.code,
    display_name: b.display_name,
    category: b.category,
    canonical_unit: b.canonical_unit,
  }));

  const profileName = (report.profiles as { name?: string } | null)?.name ?? '';

  return (
    <ReviewClient
      reportId={report.id}
      profileName={profileName}
      status={report.status}
      labName={report.lab_name ?? raw.lab_name ?? ''}
      collectedAt={report.collected_at ?? raw.collected_at ?? ''}
      pdfUrl={pdfUrl}
      initialRows={rows}
      dictionary={dictionary}
    />
  );
}
