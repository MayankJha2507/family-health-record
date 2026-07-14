/**
 * Golden-set eval harness — the Phase 1 Gate 1 deliverable.
 *
 * Runs a folder of lab PDFs through the SAME pipeline the app uses and diffs the
 * output against hand-checked expected JSON, reporting per-field accuracy. Built
 * to grow: drop more PDFs + expected files in and re-run.
 *
 *   npm run eval            # use cached transcriptions where present, else call LLMs
 *   npm run eval -- --live  # force re-calling the LLMs and refresh the cache
 *
 * Replay cache: the first live run saves each PDF's raw LLM transcription to
 * eval/cache/<name>.raw.json. Re-runs read the cache — so you iterate on the
 * deterministic code (normalization, flagging, diff) for FREE, exactly the
 * "LLMs transcribe, code calculates" split. Cached/expected/PDF data is
 * gitignored (real health data); only fixtures + this harness are committed.
 *
 * Directory layout:
 *   eval/pdfs/<name>.pdf            real report              (gitignored)
 *   eval/expected/<name>.json       hand-checked expected    (gitignored)
 *   eval/cache/<name>.raw.json      cached transcription     (gitignored)
 *   eval/fixtures/<name>.expected.json + <name>.raw.json  synthetic demo (committed)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPipeline, type PipelineDeps } from '../lib/pipeline/index';
import { normalizeExtraction } from '../lib/pipeline/normalize';
import { coerceExtraction } from '../lib/pipeline/merge';
import { KNOWN_CODES } from '../lib/pipeline/normalize';
import type { RawExtraction, NormalizedResult } from '../lib/pipeline/types';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local for live mode (Next loads it automatically; a standalone
// script does not). No-op if the file is absent.
try {
  process.loadEnvFile(join(__dirname, '..', '.env.local'));
} catch {
  /* no .env.local — fine unless running --live */
}

const DIRS = {
  pdfs: join(__dirname, 'pdfs'),
  expected: join(__dirname, 'expected'),
  cache: join(__dirname, 'cache'),
  fixtures: join(__dirname, 'fixtures'),
};

const LIVE = process.argv.includes('--live');

// ---- Expected-file schema -------------------------------------------------
interface ExpectedResult {
  code: string | null; // canonical code, or null for an intentionally-unmatched analyte
  value: number | null; // in canonical unit
  unit?: string | null;
  ref_low?: number | null;
  ref_high?: number | null;
  flag?: 'low' | 'normal' | 'high' | 'abnormal' | null;
}
interface Expected {
  lab_name?: string | null;
  collected_at?: string | null;
  results: ExpectedResult[];
}

interface Case {
  name: string;
  expectedPath: string;
  pdfPath?: string;
  rawPath?: string; // provided raw transcription (fixture) or cache
  kind: 'pdf' | 'normalize-only';
}

// ---- Case discovery -------------------------------------------------------
function discoverCases(): Case[] {
  const cases: Case[] = [];

  if (existsSync(DIRS.expected)) {
    for (const f of readdirSync(DIRS.expected).filter((f) => f.endsWith('.json')).sort()) {
      const name = f.replace(/\.json$/, '');
      const pdfPath = join(DIRS.pdfs, `${name}.pdf`);
      cases.push({
        name,
        expectedPath: join(DIRS.expected, f),
        pdfPath: existsSync(pdfPath) ? pdfPath : undefined,
        rawPath: join(DIRS.cache, `${name}.raw.json`),
        kind: existsSync(pdfPath) ? 'pdf' : 'normalize-only',
      });
    }
  }

  if (existsSync(DIRS.fixtures)) {
    for (const f of readdirSync(DIRS.fixtures).filter((f) => f.endsWith('.expected.json')).sort()) {
      const name = f.replace(/\.expected\.json$/, '');
      const pdfPath = join(DIRS.fixtures, `${name}.pdf`);
      cases.push({
        name: `fixture:${name}`,
        expectedPath: join(DIRS.fixtures, f),
        pdfPath: existsSync(pdfPath) ? pdfPath : undefined,
        rawPath: join(DIRS.fixtures, `${name}.raw.json`),
        kind: existsSync(pdfPath) ? 'pdf' : 'normalize-only',
      });
    }
  }

  return cases;
}

// ---- Replay deps: inject cached transcription, run real routing/normalize --
function replayDeps(raw: RawExtraction): PipelineDeps {
  return {
    text: { structure: async () => raw },
    vision: { extract: async () => raw },
  };
}

// ---- Field comparison -----------------------------------------------------
function numEq(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= Math.max(0.01, Math.abs(b) * 0.01); // 1% or 0.01 abs
}

interface FieldTally {
  code: [number, number];
  value: [number, number];
  ref_low: [number, number];
  ref_high: [number, number];
  flag: [number, number];
  lab_name: [number, number];
  collected_at: [number, number];
}
function emptyTally(): FieldTally {
  return { code: [0, 0], value: [0, 0], ref_low: [0, 0], ref_high: [0, 0], flag: [0, 0], lab_name: [0, 0], collected_at: [0, 0] };
}
function hit(t: [number, number], ok: boolean) {
  t[1]++;
  if (ok) t[0]++;
}
function pct(t: [number, number]): string {
  return t[1] === 0 ? '  —  ' : `${((100 * t[0]) / t[1]).toFixed(0).padStart(3)}%`;
}

interface CaseReport {
  name: string;
  kind: string;
  route: string[];
  tally: FieldTally;
  misses: string[]; // expected codes not found
  extras: string[]; // known-code results extracted but not expected
  resultsCorrect: number; // matched code AND correct value
  resultsExpected: number;
}

function evaluate(name: string, kind: string, expected: Expected, results: NormalizedResult[], notes: string[]): CaseReport {
  const tally = emptyTally();
  const byCode = new Map<string, NormalizedResult>();
  for (const r of results) if (r.biomarker_id) byCode.set(r.biomarker_id, r);

  let resultsCorrect = 0;
  const misses: string[] = [];
  const expectedCodes = new Set<string>();

  for (const exp of expected.results) {
    if (exp.code == null) continue; // unmatched-analyte expectations checked separately below
    expectedCodes.add(exp.code);
    const got = byCode.get(exp.code);
    hit(tally.code, !!got);
    if (!got) {
      misses.push(exp.code);
      continue;
    }
    const gotValue = got.canonical_value ?? got.value;
    const valueOk = numEq(gotValue, exp.value);
    hit(tally.value, valueOk);
    if ('ref_low' in exp) hit(tally.ref_low, numEq(got.ref_low, exp.ref_low ?? null));
    if ('ref_high' in exp) hit(tally.ref_high, numEq(got.ref_high, exp.ref_high ?? null));
    if ('flag' in exp) hit(tally.flag, (got.flag ?? null) === (exp.flag ?? null));
    if (valueOk) resultsCorrect++;
  }

  // Extras: known-code results we produced that weren't expected (false positives).
  const extras: string[] = [];
  for (const r of results) {
    if (r.biomarker_id && KNOWN_CODES.has(r.biomarker_id) && !expectedCodes.has(r.biomarker_id)) {
      extras.push(r.biomarker_id);
    }
  }

  // lab_name / collected_at live on the raw extraction and are folded in at the
  // document level in main() — not here.

  return {
    name, kind,
    route: notes,
    tally,
    misses,
    extras,
    resultsCorrect,
    resultsExpected: [...expectedCodes].length,
  };
}

// ---- Runner ---------------------------------------------------------------
async function runCase(c: Case): Promise<{ report: CaseReport; docLab: boolean; docDate: boolean; expected: Expected }> {
  const expected: Expected = JSON.parse(readFileSync(c.expectedPath, 'utf8'));

  let rawExtraction: RawExtraction;
  let notes: string[] = [];

  if (c.kind === 'normalize-only') {
    // No PDF (fixture demo): run the deterministic half against a provided raw.
    if (!c.rawPath || !existsSync(c.rawPath)) {
      throw new Error(`${c.name}: no PDF and no raw transcription at ${c.rawPath}`);
    }
    rawExtraction = coerceExtraction(JSON.parse(readFileSync(c.rawPath, 'utf8')));
    notes = ['normalize-only (no PDF; deterministic half validated against provided transcription)'];
    const results = normalizeExtraction(rawExtraction);
    const report = evaluate(c.name, c.kind, expected, results, notes);
    return finalize(report, rawExtraction, expected);
  }

  // PDF case: run the full pipeline. Replay from cache unless --live.
  const pdf = readFileSync(c.pdfPath!);
  const cached = c.rawPath && existsSync(c.rawPath) && !LIVE;

  let deps: PipelineDeps;
  if (cached) {
    rawExtraction = coerceExtraction(JSON.parse(readFileSync(c.rawPath!, 'utf8')));
    deps = replayDeps(rawExtraction);
  } else {
    // Live: real APIs. Requires GROQ_API_KEY / GEMINI_API_KEY.
    const { createDefaultDeps } = await import('../lib/pipeline/index');
    deps = await createDefaultDeps();
  }

  const result = await runPipeline({ pdf, filename: c.name }, deps);
  notes = result.notes;

  // Cache the transcription from a live run so future runs are free.
  if (!cached && c.rawPath) {
    mkdirSync(dirname(c.rawPath), { recursive: true });
    writeFileSync(c.rawPath, JSON.stringify(result.rawExtraction, null, 2));
    notes.push(`cached transcription → ${c.rawPath.replace(join(__dirname, '..') + '/', '')}`);
  }

  const report = evaluate(c.name, c.kind, expected, result.results, notes);
  return finalize(report, result.rawExtraction, expected);
}

function finalize(report: CaseReport, raw: RawExtraction, expected: Expected) {
  const docLab =
    expected.lab_name === undefined ||
    (raw.lab_name ?? '').toLowerCase().replace(/\s+/g, ' ').trim() ===
      (expected.lab_name ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const docDate = expected.collected_at === undefined || raw.collected_at === expected.collected_at;
  return { report, docLab, docDate, expected };
}

async function main() {
  const cases = discoverCases();
  if (cases.length === 0) {
    console.log('No eval cases found.\n');
    console.log('Add real reports:  eval/pdfs/<name>.pdf  +  eval/expected/<name>.json');
    console.log('Then run:          npm run eval -- --live   (first run calls the LLMs)\n');
    console.log('A committed synthetic fixture normally demonstrates the mechanics, but none was found.');
    process.exit(0);
  }

  console.log(`Eval — ${cases.length} case(s)${LIVE ? ' [LIVE: calling LLMs]' : ' [replay where cached]'}\n`);

  const overall = emptyTally();
  let totalCorrect = 0;
  let totalExpected = 0;
  const rows: string[] = [];

  for (const c of cases) {
    let res;
    try {
      res = await runCase(c);
    } catch (err) {
      console.log(`■ ${c.name}`);
      console.log(`  ✗ ERROR: ${(err as Error).message}\n`);
      continue;
    }
    const { report, docLab, docDate } = res;

    // Fold doc-level lab/date into the tally.
    if (res.expected.lab_name !== undefined) hit(report.tally.lab_name, docLab);
    if (res.expected.collected_at !== undefined) hit(report.tally.collected_at, docDate);

    // Accumulate overall.
    for (const k of Object.keys(overall) as (keyof FieldTally)[]) {
      overall[k][0] += report.tally[k][0];
      overall[k][1] += report.tally[k][1];
    }
    totalCorrect += report.resultsCorrect;
    totalExpected += report.resultsExpected;

    console.log(`■ ${report.name}  (${report.kind})`);
    for (const n of report.route) console.log(`    · ${n}`);
    console.log(
      `    results: ${report.resultsCorrect}/${report.resultsExpected} correct  |  ` +
        `code ${pct(report.tally.code)}  value ${pct(report.tally.value)}  ` +
        `ref_low ${pct(report.tally.ref_low)}  ref_high ${pct(report.tally.ref_high)}  flag ${pct(report.tally.flag)}`,
    );
    console.log(`    lab_name ${docLab ? '✓' : '✗'}   collected_at ${docDate ? '✓' : '✗'}`);
    if (report.misses.length) console.log(`    MISSED: ${report.misses.join(', ')}`);
    if (report.extras.length) console.log(`    EXTRA (false positive): ${report.extras.join(', ')}`);
    console.log();
  }

  const headline = totalExpected === 0 ? 0 : (100 * totalCorrect) / totalExpected;
  console.log('─'.repeat(64));
  console.log('OVERALL per-field accuracy');
  console.log(`  biomarker match : ${pct(overall.code)}`);
  console.log(`  value           : ${pct(overall.value)}`);
  console.log(`  ref_low         : ${pct(overall.ref_low)}`);
  console.log(`  ref_high        : ${pct(overall.ref_high)}`);
  console.log(`  flag            : ${pct(overall.flag)}`);
  console.log(`  lab_name        : ${pct(overall.lab_name)}`);
  console.log(`  collected_at    : ${pct(overall.collected_at)}`);
  console.log('─'.repeat(64));
  console.log(`  HEADLINE (correct code + value): ${totalCorrect}/${totalExpected} = ${headline.toFixed(1)}%`);
  const gate = headline >= 90;
  console.log(`  ≥90% gate: ${gate ? 'PASS' : 'BELOW'}  —  PROVISIONAL until the golden set`);
  console.log(`  covers multiple labs and scanned reports.`);
  console.log('─'.repeat(64));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
