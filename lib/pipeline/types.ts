/**
 * Shared schema for BOTH extraction lanes (Groq text, Gemini vision) and the
 * deterministic normalizer. The two lanes MUST emit `RawExtraction`; everything
 * downstream (normalization, eval diff, review screen) speaks these types.
 */

/** Exactly what an LLM transcribes — no interpretation, no math. */
export interface RawResult {
  /** Analyte name exactly as printed on the report. */
  name: string;
  /** Value as printed. String because reports contain "<0.01", "Negative", etc. */
  value: string;
  unit: string | null;
  /** Reference range low/high if numerically printed. */
  ref_low: number | null;
  ref_high: number | null;
  /** Range as printed when non-numeric ("<200", "Negative", "40-60"). */
  ref_text: string | null;
  /** 1-based page the value was found on. */
  page: number | null;
}

/** The raw LLM output for one report. Stored permanently in reports.raw_extraction. */
export interface RawExtraction {
  lab_name: string | null;
  /** Sample COLLECTION date (the timeline key), ISO yyyy-mm-dd if parseable. */
  collected_at: string | null;
  /** Lab's reporting date, ISO yyyy-mm-dd. */
  reported_at: string | null;
  results: RawResult[];
}

export type Flag = 'low' | 'normal' | 'high' | 'abnormal';

/** One normalized analyte, ready for the review screen / results table. */
export interface NormalizedResult {
  /** Canonical biomarker code, or null if the analyte isn't in the dictionary. */
  biomarker_id: string | null;
  raw_name: string;
  /** Numeric value as printed (in the report's unit), or null if non-numeric. */
  value: number | null;
  unit: string | null;
  /** Value converted to the canonical unit, or null. */
  canonical_value: number | null;
  canonical_unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  ref_text: string | null;
  /** Computed IN CODE against the lab's own printed range. */
  flag: Flag | null;
  page: number | null;
  /** Non-fatal issues: unmatched analyte, failed sanity check, unit not converted. */
  warnings: string[];
}

export type ParserUsed = 'groq' | 'gemini' | 'manual';

/** Full pipeline output for one PDF. */
export interface PipelineResult {
  parserUsed: ParserUsed;
  /** Persisted verbatim so improved code can re-normalize without re-calling LLMs. */
  rawExtraction: RawExtraction;
  results: NormalizedResult[];
  /** Report-level notes (routing decisions, fallbacks, rejected pages). */
  notes: string[];
}

/**
 * Injectable LLM lanes. The orchestrator depends on these interfaces, not on
 * groq-sdk / @google/genai directly — so the eval harness can supply a REPLAY
 * implementation (read cached transcription) and prove mechanics without keys.
 */
export interface TextStructurer {
  /** Structure already-extracted PDF text into RawExtraction (Groq lane). */
  structure(input: { text: string; pageTexts: string[] }): Promise<RawExtraction>;
}

export interface VisionExtractor {
  /** Extract RawExtraction directly from PDF bytes (Gemini lane). */
  extract(input: { pdf: Buffer; filename: string }): Promise<RawExtraction>;
}
