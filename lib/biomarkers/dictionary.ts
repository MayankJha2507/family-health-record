/**
 * Canonical biomarker dictionary — the SINGLE SOURCE OF TRUTH.
 *
 * The pipeline reads this in-memory for alias→canonical matching, unit
 * conversion, and sanity bounds. The Supabase seed migration is GENERATED from
 * this file (`npm run gen:seed`), so the database and the pipeline can never
 * drift. Grow `aliases` with every new lab PDF — that list is the moat.
 *
 * Rules embodied here:
 *  - LLMs transcribe; code calculates. Unit conversion and flagging live here,
 *    never in a prompt.
 *  - Aliases are lowercase; matching normalizes case/whitespace/punctuation.
 */

export type Category =
  | 'CBC'
  | 'Lipid'
  | 'LFT'
  | 'KFT'
  | 'Thyroid'
  | 'Glucose'
  | 'Vitamins'
  | 'Iron'
  | 'Inflammation';

export interface Biomarker {
  code: string;
  display_name: string;
  category: Category;
  /** Unit trends are charted in; values are converted to this. */
  canonical_unit: string;
  /** Lowercase lab-name variants that map to this biomarker. */
  aliases: string[];
  /**
   * Physiological sanity window (in canonical_unit). Values outside are almost
   * certainly a transcription error — they are FLAGGED for review, never
   * silently dropped or auto-committed.
   */
  sanity?: { min: number; max: number };
}

/**
 * Unit conversions to canonical units, keyed by biomarker code. A factor F
 * means canonical_value = raw_value * F when the raw unit (lowercased, trimmed)
 * matches. Units already equal to canonical need no entry (identity).
 * Only conversions actually seen on Indian lab reports are listed.
 */
export const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
  total_cholesterol: { 'mmol/l': 38.67 },
  hdl: { 'mmol/l': 38.67 },
  ldl: { 'mmol/l': 38.67 },
  vldl: { 'mmol/l': 38.67 },
  non_hdl: { 'mmol/l': 38.67 },
  triglycerides: { 'mmol/l': 88.57 },
  glucose_fasting: { 'mmol/l': 18.02 },
  glucose_pp: { 'mmol/l': 18.02 },
  glucose_random: { 'mmol/l': 18.02 },
  creatinine: { 'µmol/l': 0.0113, 'umol/l': 0.0113 },
  urea: { 'mmol/l': 6.006 },
  uric_acid: { 'µmol/l': 0.0168, 'umol/l': 0.0168 },
  bilirubin_total: { 'µmol/l': 0.0585, 'umol/l': 0.0585 },
  calcium: { 'mmol/l': 4.008 },
  vitamin_d: { 'nmol/l': 0.4009 },
  vitamin_b12: { 'pmol/l': 1.355 },
  folate: { 'nmol/l': 0.4413 },
};

export const BIOMARKERS: Biomarker[] = [
  // ---- CBC ----
  { code: 'hemoglobin', display_name: 'Hemoglobin', category: 'CBC', canonical_unit: 'g/dL',
    aliases: ['hemoglobin', 'haemoglobin', 'hb', 'hgb'], sanity: { min: 2, max: 25 } },
  { code: 'rbc', display_name: 'RBC Count', category: 'CBC', canonical_unit: 'million/µL',
    aliases: ['rbc count', 'total rbc count', 'red blood cell count', 'erythrocyte count'], sanity: { min: 1, max: 10 } },
  { code: 'wbc', display_name: 'WBC / Total Leukocyte Count', category: 'CBC', canonical_unit: 'thousand/µL',
    aliases: ['wbc count', 'total wbc count', 'total leukocyte count', 'tlc', 'white blood cell count'], sanity: { min: 0.5, max: 100 } },
  { code: 'platelets', display_name: 'Platelet Count', category: 'CBC', canonical_unit: 'thousand/µL',
    aliases: ['platelet count', 'platelets', 'plt'], sanity: { min: 5, max: 2000 } },
  { code: 'hematocrit', display_name: 'Hematocrit (PCV)', category: 'CBC', canonical_unit: '%',
    aliases: ['hematocrit', 'haematocrit', 'pcv', 'packed cell volume'], sanity: { min: 5, max: 75 } },
  { code: 'mcv', display_name: 'MCV', category: 'CBC', canonical_unit: 'fL',
    aliases: ['mcv', 'mean corpuscular volume'], sanity: { min: 40, max: 150 } },
  { code: 'mch', display_name: 'MCH', category: 'CBC', canonical_unit: 'pg',
    aliases: ['mch', 'mean corpuscular hemoglobin'], sanity: { min: 10, max: 50 } },
  { code: 'mchc', display_name: 'MCHC', category: 'CBC', canonical_unit: 'g/dL',
    aliases: ['mchc'], sanity: { min: 20, max: 40 } },
  { code: 'rdw', display_name: 'RDW', category: 'CBC', canonical_unit: '%',
    aliases: ['rdw', 'rdw-cv', 'red cell distribution width'], sanity: { min: 5, max: 30 } },
  { code: 'neutrophils', display_name: 'Neutrophils', category: 'CBC', canonical_unit: '%',
    aliases: ['neutrophils', 'neutrophil', 'polymorphs'], sanity: { min: 0, max: 100 } },
  { code: 'lymphocytes', display_name: 'Lymphocytes', category: 'CBC', canonical_unit: '%',
    aliases: ['lymphocytes', 'lymphocyte'], sanity: { min: 0, max: 100 } },
  { code: 'monocytes', display_name: 'Monocytes', category: 'CBC', canonical_unit: '%',
    aliases: ['monocytes'], sanity: { min: 0, max: 100 } },
  { code: 'eosinophils', display_name: 'Eosinophils', category: 'CBC', canonical_unit: '%',
    aliases: ['eosinophils'], sanity: { min: 0, max: 100 } },
  { code: 'basophils', display_name: 'Basophils', category: 'CBC', canonical_unit: '%',
    aliases: ['basophils'], sanity: { min: 0, max: 100 } },
  { code: 'esr', display_name: 'ESR', category: 'Inflammation', canonical_unit: 'mm/hr',
    aliases: ['esr', 'erythrocyte sedimentation rate'], sanity: { min: 0, max: 150 } },

  // ---- Lipid ----
  { code: 'total_cholesterol', display_name: 'Total Cholesterol', category: 'Lipid', canonical_unit: 'mg/dL',
    aliases: ['total cholesterol', 'cholesterol total', 'cholesterol', 'serum cholesterol'], sanity: { min: 50, max: 600 } },
  { code: 'hdl', display_name: 'HDL Cholesterol', category: 'Lipid', canonical_unit: 'mg/dL',
    aliases: ['hdl', 'hdl cholesterol', 'hdl - cholesterol', 'hdl cholesterol - direct', 'high density lipoprotein'], sanity: { min: 5, max: 150 } },
  { code: 'ldl', display_name: 'LDL Cholesterol', category: 'Lipid', canonical_unit: 'mg/dL',
    aliases: ['ldl', 'ldl cholesterol', 'ldl - cholesterol', 'ldl cholesterol - direct', 'low density lipoprotein'], sanity: { min: 5, max: 400 } },
  { code: 'vldl', display_name: 'VLDL Cholesterol', category: 'Lipid', canonical_unit: 'mg/dL',
    aliases: ['vldl', 'vldl cholesterol'], sanity: { min: 1, max: 200 } },
  { code: 'triglycerides', display_name: 'Triglycerides', category: 'Lipid', canonical_unit: 'mg/dL',
    aliases: ['triglycerides', 'triglyceride', 'tg'], sanity: { min: 10, max: 2000 } },
  { code: 'non_hdl', display_name: 'Non-HDL Cholesterol', category: 'Lipid', canonical_unit: 'mg/dL',
    aliases: ['non-hdl cholesterol', 'non hdl cholesterol'], sanity: { min: 10, max: 500 } },

  // ---- LFT ----
  { code: 'alt', display_name: 'ALT (SGPT)', category: 'LFT', canonical_unit: 'U/L',
    aliases: ['alt', 'sgpt', 'alt (sgpt)', 'sgpt (alt)', 'alanine aminotransferase', 'alanine transaminase'], sanity: { min: 1, max: 5000 } },
  { code: 'ast', display_name: 'AST (SGOT)', category: 'LFT', canonical_unit: 'U/L',
    aliases: ['ast', 'sgot', 'ast (sgot)', 'sgot (ast)', 'aspartate aminotransferase', 'aspartate transaminase'], sanity: { min: 1, max: 5000 } },
  { code: 'alp', display_name: 'Alkaline Phosphatase', category: 'LFT', canonical_unit: 'U/L',
    aliases: ['alp', 'alkaline phosphatase', 'serum alkaline phosphatase'], sanity: { min: 10, max: 2000 } },
  { code: 'ggt', display_name: 'GGT', category: 'LFT', canonical_unit: 'U/L',
    aliases: ['ggt', 'gamma gt', 'gamma glutamyl transferase'], sanity: { min: 1, max: 2000 } },
  { code: 'bilirubin_total', display_name: 'Bilirubin, Total', category: 'LFT', canonical_unit: 'mg/dL',
    aliases: ['bilirubin total', 'total bilirubin', 'bilirubin (total)', 'serum bilirubin total'], sanity: { min: 0, max: 50 } },
  { code: 'bilirubin_direct', display_name: 'Bilirubin, Direct', category: 'LFT', canonical_unit: 'mg/dL',
    aliases: ['bilirubin direct', 'direct bilirubin', 'bilirubin (direct)', 'conjugated bilirubin'], sanity: { min: 0, max: 40 } },
  { code: 'bilirubin_indirect', display_name: 'Bilirubin, Indirect', category: 'LFT', canonical_unit: 'mg/dL',
    aliases: ['bilirubin indirect', 'indirect bilirubin', 'unconjugated bilirubin'], sanity: { min: 0, max: 40 } },
  { code: 'total_protein', display_name: 'Total Protein', category: 'LFT', canonical_unit: 'g/dL',
    aliases: ['total protein', 'total proteins', 'serum total protein'], sanity: { min: 2, max: 12 } },
  { code: 'albumin', display_name: 'Albumin', category: 'LFT', canonical_unit: 'g/dL',
    aliases: ['albumin', 'serum albumin'], sanity: { min: 1, max: 7 } },
  { code: 'globulin', display_name: 'Globulin', category: 'LFT', canonical_unit: 'g/dL',
    aliases: ['globulin'], sanity: { min: 1, max: 8 } },
  { code: 'ag_ratio', display_name: 'A/G Ratio', category: 'LFT', canonical_unit: 'ratio',
    aliases: ['a/g ratio', 'a:g ratio', 'albumin/globulin ratio'], sanity: { min: 0.1, max: 5 } },

  // ---- KFT ----
  { code: 'urea', display_name: 'Blood Urea', category: 'KFT', canonical_unit: 'mg/dL',
    aliases: ['urea', 'blood urea', 'serum urea'], sanity: { min: 2, max: 400 } },
  { code: 'bun', display_name: 'Blood Urea Nitrogen (BUN)', category: 'KFT', canonical_unit: 'mg/dL',
    aliases: ['bun', 'blood urea nitrogen'], sanity: { min: 1, max: 200 } },
  { code: 'creatinine', display_name: 'Creatinine', category: 'KFT', canonical_unit: 'mg/dL',
    aliases: ['creatinine', 'serum creatinine'], sanity: { min: 0.1, max: 25 } },
  { code: 'uric_acid', display_name: 'Uric Acid', category: 'KFT', canonical_unit: 'mg/dL',
    aliases: ['uric acid', 'serum uric acid'], sanity: { min: 0.5, max: 25 } },
  { code: 'egfr', display_name: 'eGFR', category: 'KFT', canonical_unit: 'mL/min/1.73m²',
    aliases: ['egfr', 'estimated gfr', 'gfr'], sanity: { min: 1, max: 200 } },
  { code: 'sodium', display_name: 'Sodium', category: 'KFT', canonical_unit: 'mmol/L',
    aliases: ['sodium', 'na', 'na+'], sanity: { min: 100, max: 180 } },
  { code: 'potassium', display_name: 'Potassium', category: 'KFT', canonical_unit: 'mmol/L',
    aliases: ['potassium', 'k', 'k+'], sanity: { min: 1, max: 10 } },
  { code: 'chloride', display_name: 'Chloride', category: 'KFT', canonical_unit: 'mmol/L',
    aliases: ['chloride', 'cl', 'cl-'], sanity: { min: 70, max: 140 } },
  { code: 'calcium', display_name: 'Calcium', category: 'KFT', canonical_unit: 'mg/dL',
    aliases: ['calcium', 'serum calcium', 'total calcium'], sanity: { min: 4, max: 20 } },
  { code: 'phosphorus', display_name: 'Phosphorus', category: 'KFT', canonical_unit: 'mg/dL',
    aliases: ['phosphorus', 'phosphorous', 'inorganic phosphorus'], sanity: { min: 0.5, max: 15 } },

  // ---- Thyroid ----
  { code: 'tsh', display_name: 'TSH', category: 'Thyroid', canonical_unit: 'µIU/mL',
    aliases: ['tsh', 'thyroid stimulating hormone', 'tsh - ultrasensitive'], sanity: { min: 0, max: 150 } },
  { code: 't3', display_name: 'T3 (Total)', category: 'Thyroid', canonical_unit: 'ng/dL',
    aliases: ['t3', 'total t3', 'triiodothyronine'], sanity: { min: 10, max: 800 } },
  { code: 't4', display_name: 'T4 (Total)', category: 'Thyroid', canonical_unit: 'µg/dL',
    aliases: ['t4', 'total t4', 'thyroxine'], sanity: { min: 1, max: 30 } },
  { code: 'ft3', display_name: 'Free T3', category: 'Thyroid', canonical_unit: 'pg/mL',
    aliases: ['ft3', 'free t3', 'free triiodothyronine'], sanity: { min: 0.5, max: 30 } },
  { code: 'ft4', display_name: 'Free T4', category: 'Thyroid', canonical_unit: 'ng/dL',
    aliases: ['ft4', 'free t4', 'free thyroxine'], sanity: { min: 0.1, max: 12 } },

  // ---- Glucose ----
  { code: 'glucose_fasting', display_name: 'Fasting Blood Glucose', category: 'Glucose', canonical_unit: 'mg/dL',
    aliases: ['fasting blood sugar', 'fasting blood glucose', 'fbs', 'glucose fasting', 'blood sugar fasting'], sanity: { min: 20, max: 800 } },
  { code: 'glucose_pp', display_name: 'Post-Prandial Blood Glucose', category: 'Glucose', canonical_unit: 'mg/dL',
    aliases: ['post prandial blood sugar', 'postprandial blood glucose', 'ppbs', 'pp blood sugar', 'blood sugar pp'], sanity: { min: 20, max: 1000 } },
  { code: 'glucose_random', display_name: 'Random Blood Glucose', category: 'Glucose', canonical_unit: 'mg/dL',
    aliases: ['random blood sugar', 'rbs', 'random blood glucose'], sanity: { min: 20, max: 1000 } },
  { code: 'hba1c', display_name: 'HbA1c', category: 'Glucose', canonical_unit: '%',
    aliases: ['hba1c', 'hba1c (glycated hemoglobin)', 'glycated hemoglobin', 'glycosylated hemoglobin', 'hemoglobin a1c'], sanity: { min: 2, max: 20 } },
  { code: 'insulin_fasting', display_name: 'Fasting Insulin', category: 'Glucose', canonical_unit: 'µIU/mL',
    aliases: ['fasting insulin', 'insulin fasting'], sanity: { min: 0, max: 400 } },

  // ---- Vitamins ----
  { code: 'vitamin_d', display_name: 'Vitamin D (25-OH)', category: 'Vitamins', canonical_unit: 'ng/mL',
    aliases: ['vitamin d', 'vitamin d (25-oh)', '25-oh vitamin d', '25 hydroxy vitamin d', 'vitamin d total'], sanity: { min: 1, max: 200 } },
  { code: 'vitamin_b12', display_name: 'Vitamin B12', category: 'Vitamins', canonical_unit: 'pg/mL',
    aliases: ['vitamin b12', 'vitamin b-12', 'b12', 'cyanocobalamin'], sanity: { min: 50, max: 5000 } },
  { code: 'folate', display_name: 'Folate', category: 'Vitamins', canonical_unit: 'ng/mL',
    aliases: ['folate', 'folic acid', 'serum folate'], sanity: { min: 0.5, max: 40 } },

  // ---- Iron ----
  { code: 'iron', display_name: 'Serum Iron', category: 'Iron', canonical_unit: 'µg/dL',
    aliases: ['iron', 'serum iron'], sanity: { min: 5, max: 500 } },
  { code: 'ferritin', display_name: 'Ferritin', category: 'Iron', canonical_unit: 'ng/mL',
    aliases: ['ferritin', 'serum ferritin'], sanity: { min: 1, max: 10000 } },
  { code: 'tibc', display_name: 'TIBC', category: 'Iron', canonical_unit: 'µg/dL',
    aliases: ['tibc', 'total iron binding capacity'], sanity: { min: 100, max: 700 } },
  { code: 'transferrin_sat', display_name: 'Transferrin Saturation', category: 'Iron', canonical_unit: '%',
    aliases: ['transferrin saturation', 'transferrin saturation (%)', 'tsat'], sanity: { min: 0, max: 100 } },

  // ---- Inflammation ----
  { code: 'crp', display_name: 'C-Reactive Protein (CRP)', category: 'Inflammation', canonical_unit: 'mg/L',
    aliases: ['crp', 'c-reactive protein', 'c reactive protein', 'crp quantitative'], sanity: { min: 0, max: 500 } },
];

/** Collapse case, whitespace, and stray punctuation for alias matching. */
export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.µ]/g, (m) => (m === '.' ? '' : m)) // drop periods, keep µ
    .replace(/\s+/g, ' ')
    .replace(/\s*[-–]\s*/g, ' - ')
    .trim();
}

// Precomputed alias → biomarker index. Aliases are matched after normalizeName.
const ALIAS_INDEX = new Map<string, Biomarker>();
for (const b of BIOMARKERS) {
  for (const alias of b.aliases) ALIAS_INDEX.set(normalizeName(alias), b);
}

/** Resolve a lab-printed analyte name to a canonical biomarker, or null. */
export function matchBiomarker(rawName: string): Biomarker | null {
  return ALIAS_INDEX.get(normalizeName(rawName)) ?? null;
}

/**
 * Trailing suffixes that denote a measurement METHOD (not a different analyte),
 * safe to ignore when an exact alias match fails. Kept deliberately small.
 */
const METHOD_SUFFIXES = new Set([
  'direct',      // e.g. "LDL Cholesterol - Direct" (direct assay vs. calculated)
  'indirect',    // a method for some analytes — but a DISTINCT fraction for others
  'calculated',  // (see DISTINCT_FRACTION_ROOTS guard below)
  'measured',
  'photometry',
  'serum',
  'plasma',
]);

/**
 * Analyte roots where "direct"/"indirect" name a DISTINCT fraction, not a
 * method — merging them would fuse two genuinely different measurements. For
 * these we refuse to strip and surface the name for human review instead.
 * GROW THIS LIST whenever a new distinct-fraction analyte is added.
 */
const DISTINCT_FRACTION_ROOTS = ['bilirubin'];

export interface MatchResult {
  biomarker: Biomarker | null;
  via: 'exact' | 'suffix-strip' | 'none';
  /** The method suffix that was stripped to reach a match (for auditing). */
  strippedSuffix?: string;
  /** A suffix deliberately NOT stripped because it may mean a distinct analyte. */
  ambiguousSuffix?: string;
}

/**
 * Like matchBiomarker, but with conservative, AUDITABLE method-suffix stripping
 * as a fallback. Never strips a direct/indirect suffix off a distinct-fraction
 * analyte (e.g. bilirubin) — it flags those instead so nothing silently merges.
 */
export function resolveBiomarker(rawName: string): MatchResult {
  const norm = normalizeName(rawName);
  const exact = ALIAS_INDEX.get(norm);
  if (exact) return { biomarker: exact, via: 'exact' };

  // Try stripping exactly one trailing " - <word>" suffix.
  const m = norm.match(/^(.+?)\s*-\s*([a-z]+)$/);
  if (m) {
    const base = m[1].trim();
    const suffix = m[2];
    if (METHOD_SUFFIXES.has(suffix)) {
      const rootIsDistinct = DISTINCT_FRACTION_ROOTS.some((r) => base.includes(r));
      if (rootIsDistinct && (suffix === 'direct' || suffix === 'indirect')) {
        // e.g. "bilirubin - indirect": a distinct analyte. Do NOT merge.
        return { biomarker: null, via: 'none', ambiguousSuffix: suffix };
      }
      const baseMatch = ALIAS_INDEX.get(normalizeName(base));
      if (baseMatch) return { biomarker: baseMatch, via: 'suffix-strip', strippedSuffix: suffix };
    }
  }
  return { biomarker: null, via: 'none' };
}

export function getBiomarker(code: string): Biomarker | undefined {
  return BIOMARKERS.find((b) => b.code === code);
}
