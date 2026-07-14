/**
 * Defensive coercion + merging of LLM output. LLMs occasionally return a slightly
 * off shape (missing fields, numbers as strings, a bare array). We coerce into a
 * strict RawExtraction rather than trusting the model, and expose a junk-detector
 * that the orchestrator uses to fall back from the text lane to vision instead of
 * committing garbage.
 */
import type { RawExtraction, RawResult } from './types';

function toStringOrNull(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v.trim() === '' ? null : v.trim();
  if (typeof v === 'number') return String(v);
  return null;
}

function toNumberOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v.replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function coerceResult(r: unknown): RawResult | null {
  if (!r || typeof r !== 'object') return null;
  const o = r as Record<string, unknown>;
  const name = toStringOrNull(o.name);
  const value = toStringOrNull(o.value);
  // A result with no name or no value isn't usable.
  if (!name || value == null) return null;
  return {
    name,
    value,
    unit: toStringOrNull(o.unit),
    ref_low: toNumberOrNull(o.ref_low),
    ref_high: toNumberOrNull(o.ref_high),
    ref_text: toStringOrNull(o.ref_text),
    page: toNumberOrNull(o.page),
  };
}

/** Coerce arbitrary parsed JSON into a strict RawExtraction. */
export function coerceExtraction(raw: unknown): RawExtraction {
  // Accept both {results:[...]} and a bare [...] of results.
  const obj = Array.isArray(raw) ? { results: raw } : ((raw ?? {}) as Record<string, unknown>);
  const resultsIn = Array.isArray(obj.results) ? obj.results : [];
  const results = resultsIn.map(coerceResult).filter((r): r is RawResult => r !== null);
  return {
    lab_name: toStringOrNull(obj.lab_name),
    collected_at: toStringOrNull(obj.collected_at),
    reported_at: toStringOrNull(obj.reported_at),
    results,
  };
}

/** Merge page-chunk partials into one extraction; first non-null wins for metadata. */
export function mergeExtractions(partials: RawExtraction[]): RawExtraction {
  return {
    lab_name: partials.map((p) => p.lab_name).find((v) => v) ?? null,
    collected_at: partials.map((p) => p.collected_at).find((v) => v) ?? null,
    reported_at: partials.map((p) => p.reported_at).find((v) => v) ?? null,
    results: partials.flatMap((p) => p.results),
  };
}

/**
 * Heuristic: did the text lane produce usable output? Used to trigger the
 * vision fallback. "Junk" = no results, or far fewer results than the number of
 * value-like tokens on the page suggests (the model gave up / hallucinated an
 * empty doc from real text).
 */
export function isLikelyJunk(extraction: RawExtraction, sourceText: string): boolean {
  if (extraction.results.length === 0) return true;
  // Count "12.3 unit" style value tokens in the source; if the page clearly has
  // many results but the model returned almost none, treat it as junk.
  const valueTokens = (sourceText.match(/\d+\.?\d*\s*(mg|g|u\/l|%|ng|pg|iu|mmol|million|thousand|fl|pg|cells)/gi) ?? []).length;
  if (valueTokens >= 6 && extraction.results.length < Math.ceil(valueTokens / 4)) return true;
  return false;
}
