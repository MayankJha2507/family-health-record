/**
 * Deterministic post-processing. THIS is where all math and judgment live —
 * the LLMs only transcribe. Given a RawExtraction, produce NormalizedResults:
 *   - alias → canonical biomarker matching
 *   - numeric parsing of printed values
 *   - unit conversion to canonical units
 *   - sanity-bound checks (out-of-range → warning, never dropped)
 *   - flagging against the LAB'S OWN printed reference range
 */
import {
  BIOMARKERS,
  UNIT_CONVERSIONS,
  matchBiomarker,
  normalizeName,
  type Biomarker,
} from '../biomarkers/dictionary';
import type { Flag, NormalizedResult, RawExtraction, RawResult } from './types';

/** Parse a printed value string into a number, or null if non-numeric. */
export function parseValue(printed: string): number | null {
  if (printed == null) return null;
  // Strip commas, take the first numeric token. Leave "<0.01"/"Negative" as null
  // (those live in ref_text / raw value, not the numeric trend).
  const cleaned = printed.replace(/,/g, '').trim();
  const m = cleaned.match(/^-?\d+(\.\d+)?$/);
  return m ? Number(cleaned) : null;
}

/** Convert a value to the biomarker's canonical unit. Returns [value, unit]. */
function toCanonical(bm: Biomarker, value: number, unit: string | null): {
  value: number;
  unit: string;
  converted: boolean;
  unhandledUnit: boolean;
} {
  const canonical = bm.canonical_unit;
  if (!unit || normalizeName(unit) === normalizeName(canonical)) {
    return { value, unit: canonical, converted: false, unhandledUnit: false };
  }
  const factor = UNIT_CONVERSIONS[bm.code]?.[normalizeName(unit)];
  if (factor != null) {
    return { value: round(value * factor), unit: canonical, converted: true, unhandledUnit: false };
  }
  // Unit differs and we have no rule. Keep the value but flag it — do NOT guess.
  return { value, unit: canonical, converted: false, unhandledUnit: true };
}

/** Flag against the lab's own printed numeric range. */
function computeFlag(
  value: number | null,
  refLow: number | null,
  refHigh: number | null,
): Flag | null {
  if (value == null) return null;
  if (refLow != null && value < refLow) return 'low';
  if (refHigh != null && value > refHigh) return 'high';
  if (refLow != null || refHigh != null) return 'normal';
  return null; // no numeric range printed → cannot flag deterministically
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function normalizeResult(raw: RawResult): NormalizedResult {
  const warnings: string[] = [];
  const bm = matchBiomarker(raw.name);
  const value = parseValue(raw.value);

  let canonical_value: number | null = null;
  let canonical_unit: string | null = null;

  if (bm && value != null) {
    const c = toCanonical(bm, value, raw.unit);
    canonical_value = c.value;
    canonical_unit = c.unit;
    if (c.unhandledUnit) {
      warnings.push(`unit "${raw.unit}" not convertible to ${bm.canonical_unit}; value kept as-is — verify`);
    }
    if (bm.sanity && (canonical_value < bm.sanity.min || canonical_value > bm.sanity.max)) {
      warnings.push(
        `value ${canonical_value} ${bm.canonical_unit} outside physiological range ` +
          `[${bm.sanity.min}, ${bm.sanity.max}] — likely a transcription error, verify`,
      );
    }
  } else if (bm && value == null) {
    canonical_unit = bm.canonical_unit;
    warnings.push(`non-numeric value "${raw.value}" — not trended; verify or enter manually`);
  }

  if (!bm) {
    warnings.push('analyte not in dictionary — stored raw, not trended');
  }

  const flag = computeFlag(value, raw.ref_low, raw.ref_high);

  return {
    biomarker_id: bm?.code ?? null,
    raw_name: raw.name,
    value,
    unit: raw.unit,
    canonical_value,
    canonical_unit,
    ref_low: raw.ref_low,
    ref_high: raw.ref_high,
    ref_text: raw.ref_text,
    flag,
    page: raw.page,
    warnings,
  };
}

export function normalizeExtraction(raw: RawExtraction): NormalizedResult[] {
  return raw.results.map(normalizeResult);
}

/** Codes known to the dictionary — handy for eval and UI. */
export const KNOWN_CODES = new Set(BIOMARKERS.map((b) => b.code));
