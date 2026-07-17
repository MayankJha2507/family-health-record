/**
 * FICTIONAL marketing data — for the landing-page mockups ONLY.
 *
 * ⚠️ This is invented sample data for screenshots. It is NOT real, never touches
 * the results table, the pipeline, or any real record, and must never be imported
 * outside app/landing/. The app itself is real-data-only; this file is the
 * deliberate marketing exception.
 */

export interface MockSeries {
  name: string;
  unit: string;
  /** oldest → newest */
  points: number[];
  refLow: number | null;
  refHigh: number | null;
  /** desirable direction, for good/bad colouring in the mockups */
  direction: 'lower-better' | 'higher-better' | 'in-band-better';
  rangeLabel: string;
}

/** ~1 year of visits for a made-up person. */
export const MOCK_DATES = ['Mar 25', 'Jun 25', 'Sep 25', 'Dec 25', 'Feb 26'];

export const MOCK_PERSON = { name: 'Meera Nair', meta: 'self · 52y · female', reports: MOCK_DATES.length };

export const SERIES: Record<string, MockSeries> = {
  hba1c: { name: 'HbA1c', unit: '%', points: [7.6, 7.1, 6.8, 6.5, 6.2], refLow: null, refHigh: 5.7, direction: 'lower-better', rangeLabel: '< 5.7' },
  ldl: { name: 'LDL Cholesterol', unit: 'mg/dL', points: [168, 152, 141, 130, 122], refLow: null, refHigh: 100, direction: 'lower-better', rangeLabel: '< 100' },
  vitaminD: { name: 'Vitamin D', unit: 'ng/mL', points: [16, 22, 29, 34, 39], refLow: 30, refHigh: 100, direction: 'higher-better', rangeLabel: '30–100' },
  tsh: { name: 'TSH', unit: 'µIU/mL', points: [2.1, 2.6, 3.2, 3.9, 4.7], refLow: 0.4, refHigh: 4.5, direction: 'in-band-better', rangeLabel: '0.4–4.5' },
  triglycerides: { name: 'Triglycerides', unit: 'mg/dL', points: [182, 168, 156, 148, 139], refLow: null, refHigh: 150, direction: 'lower-better', rangeLabel: '< 150' },
  hdl: { name: 'HDL Cholesterol', unit: 'mg/dL', points: [62, 64, 66, 68, 70], refLow: 40, refHigh: 60, direction: 'higher-better', rangeLabel: '40–60' },
  hemoglobin: { name: 'Hemoglobin', unit: 'g/dL', points: [12.6, 12.8, 13.0, 13.1, 13.2], refLow: 12, refHigh: 15.5, direction: 'in-band-better', rangeLabel: '12–15.5' },
};

/** Latest value + trend direction helper for a series. */
export function latest(s: MockSeries) {
  const v = s.points[s.points.length - 1];
  const prev = s.points[s.points.length - 2];
  const flag: 'high' | 'low' | 'normal' =
    s.refHigh != null && v > s.refHigh ? 'high' : s.refLow != null && v < s.refLow ? 'low' : 'normal';
  const concerning =
    (flag === 'high' && s.direction !== 'higher-better') || (flag === 'low' && s.direction !== 'lower-better');
  const changePct = prev ? ((v - prev) / Math.abs(prev)) * 100 : 0;
  // good/bad of the latest move, for colouring
  const rising = v > prev;
  const quality: 'good' | 'bad' | 'neutral' =
    s.direction === 'lower-better' ? (rising ? 'bad' : 'good')
    : s.direction === 'higher-better' ? (rising ? 'good' : 'bad')
    : 'neutral';
  return { v, prev, flag, concerning, changePct, quality };
}

/** The made-up family for the multi-profile mockup. */
export const MOCK_FAMILY = [
  { name: 'Meera Nair', meta: 'self · 52', status: '2 to discuss', tone: 'concern' as const },
  { name: 'Arun Nair', meta: 'father · 78', status: '1 to discuss', tone: 'concern' as const },
  { name: 'Kavya Nair', meta: 'daughter · 19', status: 'all in range', tone: 'clear' as const },
];
