/**
 * Server-side report processing (Gate 2b). Downloads the uploaded PDF from the
 * private bucket, runs the SAME lib/pipeline the eval validates, persists the
 * raw transcription + draft metadata, and flips the report to needs_review.
 *
 * HARD RULE: this NEVER writes to the results table. The pipeline produces a
 * DRAFT (raw_extraction). Nothing becomes a stored health fact until the user
 * confirms on the review screen. A wrong transcription must stay a correctable
 * draft.
 *
 * The passed-in Supabase client carries the user's session, so every read/write
 * here is owner-gated by RLS — a user can only process their own report.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { runPipeline, createDefaultDeps } from '../pipeline';
import type { PipelineResult } from '../pipeline/types';

export interface ProcessOutcome {
  status: 'needs_review' | 'failed';
  parserUsed?: PipelineResult['parserUsed'];
  resultCount?: number;
  unmatchedCount?: number;
  notes?: string[];
  error?: string;
}

export async function processReport(
  reportId: string,
  supabase: SupabaseClient,
): Promise<ProcessOutcome> {
  // 1. Load the report (RLS scopes this to the owner).
  const { data: report, error: loadErr } = await supabase
    .from('reports')
    .select('id, storage_path, status')
    .eq('id', reportId)
    .single();

  if (loadErr || !report) {
    return { status: 'failed', error: loadErr?.message ?? 'report not found' };
  }
  if (!report.storage_path) {
    await markFailed(supabase, reportId);
    return { status: 'failed', error: 'report has no storage_path' };
  }

  try {
    // 2. Download the PDF from the private bucket (owner-gated by storage RLS).
    const { data: blob, error: dlErr } = await supabase.storage
      .from('reports')
      .download(report.storage_path);
    if (dlErr || !blob) throw new Error(`download failed: ${dlErr?.message ?? 'no data'}`);
    const pdf = Buffer.from(await blob.arrayBuffer());

    // 3. Run the pipeline (same Groq/Gemini code the eval exercises).
    const result = await runPipeline(
      { pdf, filename: report.storage_path },
      await createDefaultDeps(),
    );

    // 4. Persist the DRAFT: raw transcription + draft metadata, status → needs_review.
    //    results are intentionally NOT written here.
    const { error: upErr } = await supabase
      .from('reports')
      .update({
        raw_extraction: result.rawExtraction,
        parser_used: result.parserUsed,
        lab_name: result.rawExtraction.lab_name,
        collected_at: result.rawExtraction.collected_at,
        reported_at: result.rawExtraction.reported_at,
        status: 'needs_review',
      })
      .eq('id', reportId);
    if (upErr) throw new Error(`persist failed: ${upErr.message}`);

    return {
      status: 'needs_review',
      parserUsed: result.parserUsed,
      resultCount: result.results.length,
      unmatchedCount: result.results.filter((r) => r.biomarker_id === null).length,
      notes: result.notes,
    };
  } catch (err) {
    await markFailed(supabase, reportId);
    return { status: 'failed', error: (err as Error).message };
  }
}

async function markFailed(supabase: SupabaseClient, reportId: string) {
  await supabase.from('reports').update({ status: 'failed' }).eq('id', reportId);
}
