/**
 * Gate 2b end-to-end proof against LIVE Supabase + the real pipeline.
 *
 * Exercises the exact server path the upload UI drives — upload PDF → reports row
 * (processing) → processReport() → needs_review — and asserts the hard rule:
 * NOTHING is written to the results table by the pipeline.
 *
 *   npm run test:pipeline-e2e
 *
 * Uses one real PDF (eval/pdfs/report-a.pdf) so it makes only a couple of Groq
 * calls (text lane; Gemini untouched). Creates and cleans up a throwaway user.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { processReport } from '../lib/reports/process';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(join(__dirname, '..', '.env.local'));
} catch { /* env may come from the shell */ }

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PDF = join(__dirname, '..', 'eval', 'pdfs', 'report-a.pdf');

let passed = 0, failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? `  — ${detail}` : ''}`); }
}

async function main() {
  for (const [k, v] of [['NEXT_PUBLIC_SUPABASE_URL', URL], ['NEXT_PUBLIC_SUPABASE_ANON_KEY', ANON], ['SUPABASE_SERVICE_ROLE_KEY', SERVICE], ['GROQ_API_KEY', process.env.GROQ_API_KEY]]) {
    if (!v) { console.error(`Missing ${k} in .env.local`); process.exit(2); }
  }
  if (!existsSync(PDF)) { console.error(`Missing ${PDF}`); process.exit(2); }

  const admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
  const stamp = Date.now();
  const email = `e2e-${stamp}@example.test`;
  const pw = `Test-${stamp}-pw!`;

  const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password: pw, email_confirm: true });
  if (cErr || !created.user) throw new Error(`createUser failed: ${cErr?.message}`);
  const userId = created.user.id;

  const userClient: SupabaseClient = createClient(URL!, ANON!, { auth: { persistSession: false } });
  const { error: sErr } = await userClient.auth.signInWithPassword({ email, password: pw });
  if (sErr) throw new Error(`sign-in failed: ${sErr.message}`);

  const reportId = crypto.randomUUID();
  const path = `${userId}/${reportId}.pdf`;
  let profileId: string | undefined;

  try {
    // Profile (owner-gated).
    const { data: prof, error: pErr } = await userClient
      .from('profiles').insert({ name: 'E2E Test' }).select('id').single();
    if (pErr || !prof) throw new Error(`profile insert failed: ${pErr?.message}`);
    profileId = prof.id;

    // 1. Upload the PDF (RLS-gated storage).
    const pdf = readFileSync(PDF);
    const up = await userClient.storage.from('reports').upload(path, pdf, { contentType: 'application/pdf' });
    check('PDF uploads to the private bucket', !up.error, up.error?.message);

    // 2. reports row starts as processing.
    const { error: rErr } = await userClient.from('reports')
      .insert({ id: reportId, profile_id: profileId, storage_path: path, status: 'processing' });
    check('reports row created with status=processing', !rErr, rErr?.message);

    // 3. Run the pipeline trigger (same code the route calls).
    console.log('  … running pipeline (live Groq text lane)');
    const outcome = await processReport(reportId, userClient);
    check('processReport returns needs_review', outcome.status === 'needs_review',
      outcome.error ?? `status=${outcome.status}`);
    check('parser routed to groq (digital PDF)', outcome.parserUsed === 'groq', `parser=${outcome.parserUsed}`);
    check('pipeline extracted results into the draft', (outcome.resultCount ?? 0) >= 6,
      `resultCount=${outcome.resultCount}`);

    // 4. The report row reflects the draft + needs_review.
    const { data: row } = await userClient.from('reports')
      .select('status, parser_used, lab_name, collected_at, raw_extraction').eq('id', reportId).single();
    check('report.status flipped to needs_review', row?.status === 'needs_review', `status=${row?.status}`);
    check('raw_extraction persisted (draft transcription kept)', !!row?.raw_extraction && Array.isArray(row.raw_extraction.results),
      'raw_extraction missing');
    check('draft metadata set (lab_name + collected_at)', !!row?.lab_name && !!row?.collected_at,
      `lab=${row?.lab_name} collected=${row?.collected_at}`);

    // 5. HARD RULE: the pipeline wrote NOTHING to results.
    const { count } = await userClient.from('results')
      .select('id', { count: 'exact', head: true }).eq('report_id', reportId);
    check('HARD RULE: zero results rows written by the pipeline', (count ?? 0) === 0,
      `found ${count} results row(s) — pipeline must not commit health data`);
  } finally {
    // Cleanup (service role bypasses RLS). Swallow errors — best-effort teardown.
    const swallow = async (p: PromiseLike<unknown>) => { try { await p; } catch { /* ignore */ } };
    await swallow(admin.from('reports').delete().eq('id', reportId));
    if (profileId) await swallow(admin.from('profiles').delete().eq('id', profileId));
    await swallow(admin.storage.from('reports').remove([path]));
    await swallow(admin.auth.admin.deleteUser(userId));
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
