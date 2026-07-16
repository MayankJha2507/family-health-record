'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { deriveResultFields, type EditedRow } from '@/lib/pipeline/normalize';

export interface ConfirmPayload {
  reportId: string;
  lab_name: string | null;
  collected_at: string | null; // yyyy-mm-dd — the timeline key, required
  rows: EditedRow[];
}

export interface ConfirmError {
  ok: false;
  error: string;
}

/**
 * Commit a reviewed report to the results table. THIS is the only writer of
 * health facts — the pipeline never writes here. Values are re-derived in code
 * from the user's edits (deriveResultFields), never trusted from the client.
 * Every write is owner-gated by RLS via the session client.
 */
export async function confirmReport(payload: ConfirmPayload): Promise<ConfirmError | void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // collected_at is the timeline key — refuse to commit without a valid date,
  // otherwise the trend would misorder.
  if (!payload.collected_at || Number.isNaN(Date.parse(payload.collected_at))) {
    return { ok: false, error: 'A valid collection date is required before saving.' };
  }

  // Load the report to get its profile_id (and confirm ownership via RLS).
  const { data: report, error: repErr } = await supabase
    .from('reports')
    .select('id, profile_id, status')
    .eq('id', payload.reportId)
    .single();
  if (repErr || !report) {
    return { ok: false, error: 'Report not found or not accessible.' };
  }

  // Build result rows, deriving canonical value + flag in code.
  const rows = payload.rows
    .filter((r) => r.raw_name.trim() !== '')
    .map((r) => {
      const d = deriveResultFields(r);
      return {
        report_id: report.id,
        profile_id: report.profile_id,
        biomarker_id_code: r.biomarker_id, // resolved to uuid below
        raw_name: r.raw_name.trim(),
        value: r.value,
        unit: r.unit,
        canonical_value: d.canonical_value,
        canonical_unit: d.canonical_unit,
        ref_low: d.ref_low,
        ref_high: d.ref_high,
        ref_text: r.ref_text,
        flag: d.flag,
        measured_at: payload.collected_at,
        entered_manually: r.entered_manually,
      };
    });

  // Map biomarker codes → uuids from the dictionary table (results.biomarker_id
  // is a uuid FK; the dictionary uses stable codes).
  const codes = [...new Set(rows.map((r) => r.biomarker_id_code).filter(Boolean))] as string[];
  const { data: bms } = await supabase.from('biomarkers').select('id, code').in('code', codes);
  const codeToId = new Map((bms ?? []).map((b) => [b.code, b.id]));

  const inserts = rows.map(({ biomarker_id_code, ...rest }) => ({
    ...rest,
    biomarker_id: biomarker_id_code ? codeToId.get(biomarker_id_code) ?? null : null,
  }));

  // Re-confirm safety: clear any prior results for this report, then insert.
  const { error: delErr } = await supabase.from('results').delete().eq('report_id', report.id);
  if (delErr) return { ok: false, error: `Could not clear previous values: ${delErr.message}` };

  if (inserts.length > 0) {
    const { error: insErr } = await supabase.from('results').insert(inserts);
    if (insErr) return { ok: false, error: `Could not save values: ${insErr.message}` };
  }

  // Persist edited report metadata and mark confirmed.
  const { error: upErr } = await supabase
    .from('reports')
    .update({
      lab_name: payload.lab_name,
      collected_at: payload.collected_at,
      status: 'confirmed',
    })
    .eq('id', report.id);
  if (upErr) return { ok: false, error: `Could not finalize report: ${upErr.message}` };

  redirect('/');
}
