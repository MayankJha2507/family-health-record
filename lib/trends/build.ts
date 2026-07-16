/**
 * Trend model builder. Pure: takes confirmed result rows for one profile and
 * produces the triaged view model the profile page renders. No diagnosis — only
 * "in range / out of range vs the lab's own range" and whether a change is in a
 * good or bad direction for that specific marker.
 */
import { getBiomarker, PANEL_ORDER, type Category, type Direction } from '@/lib/biomarkers/dictionary';

/** One confirmed measurement, as stored in results (joined to its biomarker code). */
export interface ResultRow {
  code: string | null; // canonical code (null = untracked analyte)
  raw_name: string;
  value: number | null;
  canonical_value: number | null;
  canonical_unit: string | null;
  unit: string | null;
  ref_low: number | null;
  ref_high: number | null;
  flag: string | null;
  measured_at: string; // yyyy-mm-dd
}

export interface TrendPoint {
  date: string;
  value: number | null;
  ref_low: number | null;
  ref_high: number | null;
  flag: string | null;
}

export interface MarkerSeries {
  code: string;
  display_name: string;
  category: Category;
  unit: string;
  direction: Direction;
  core: boolean;
  points: TrendPoint[]; // ascending by date
  latest: TrendPoint;
  previous: TrendPoint | null;
  abnormal: boolean; // latest outside the lab's range
  changed: boolean; // moved meaningfully since previous
  changePct: number | null; // signed % change latest vs previous
  changeQuality: 'good' | 'bad' | 'neutral' | null;
}

export interface UntrackedMarker {
  raw_name: string;
  value: number | null;
  unit: string | null;
  date: string;
}

export interface ProfileTrends {
  series: MarkerSeries[];
  attention: MarkerSeries[]; // out-of-range at latest
  recentlyChanged: MarkerSeries[]; // in-range but moved meaningfully
  byPanel: { category: Category; markers: MarkerSeries[] }[];
  untracked: UntrackedMarker[];
  totalConfirmedReports: number;
}

const MEANINGFUL_PCT = 10; // ≥10% move counts as "recently changed"

function isAbnormal(flag: string | null): boolean {
  return flag === 'low' || flag === 'high' || flag === 'abnormal';
}

/** How near a value sits to the middle of its range (for in-band direction). */
function distanceOutside(value: number, low: number | null, high: number | null): number {
  if (low != null && value < low) return low - value;
  if (high != null && value > high) return value - high;
  return 0; // inside range
}

function computeQuality(
  direction: Direction,
  prev: TrendPoint,
  latest: TrendPoint,
): 'good' | 'bad' | 'neutral' {
  const a = prev.value;
  const b = latest.value;
  if (a == null || b == null || a === b) return 'neutral';
  const rising = b > a;
  if (direction === 'lower-better') return rising ? 'bad' : 'good';
  if (direction === 'higher-better') return rising ? 'good' : 'bad';
  // in-band-better: better if it moved toward/into the range.
  const dPrev = distanceOutside(a, latest.ref_low, latest.ref_high);
  const dNow = distanceOutside(b, latest.ref_low, latest.ref_high);
  if (dNow < dPrev) return 'good';
  if (dNow > dPrev) return 'bad';
  return 'neutral';
}

export function buildProfileTrends(rows: ResultRow[], totalConfirmedReports: number): ProfileTrends {
  // --- tracked markers, grouped by canonical code ---
  const groups = new Map<string, ResultRow[]>();
  const untrackedRows: ResultRow[] = [];
  for (const r of rows) {
    if (r.code) {
      (groups.get(r.code) ?? groups.set(r.code, []).get(r.code)!).push(r);
    } else {
      untrackedRows.push(r);
    }
  }

  const series: MarkerSeries[] = [];
  for (const [code, rs] of groups) {
    const bm = getBiomarker(code);
    if (!bm) continue;
    const points: TrendPoint[] = rs
      .map((r) => ({
        date: r.measured_at,
        value: r.canonical_value,
        ref_low: r.ref_low,
        ref_high: r.ref_high,
        flag: r.flag,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const latest = points[points.length - 1];
    const previous = points.length >= 2 ? points[points.length - 2] : null;

    let changePct: number | null = null;
    let changed = false;
    let changeQuality: MarkerSeries['changeQuality'] = null;
    if (previous && previous.value != null && latest.value != null && previous.value !== 0) {
      changePct = ((latest.value - previous.value) / Math.abs(previous.value)) * 100;
      changed = Math.abs(changePct) >= MEANINGFUL_PCT || latest.flag !== previous.flag;
      changeQuality = computeQuality(bm.direction ?? 'in-band-better', previous, latest);
    }

    series.push({
      code,
      display_name: bm.display_name,
      category: bm.category,
      unit: bm.canonical_unit,
      direction: bm.direction ?? 'in-band-better',
      core: !!bm.core,
      points,
      latest,
      previous,
      abnormal: isAbnormal(latest.flag),
      changed,
      changePct,
      changeQuality,
    });
  }

  // Sort: core first, then by display name — stable, predictable.
  series.sort((a, b) => Number(b.core) - Number(a.core) || a.display_name.localeCompare(b.display_name));

  const attention = series.filter((s) => s.abnormal);
  const recentlyChanged = series.filter((s) => !s.abnormal && s.changed);

  // Panels: group ALL tracked series by category, in report order.
  const byPanel = PANEL_ORDER.map((category) => ({
    category,
    markers: series.filter((s) => s.category === category),
  })).filter((p) => p.markers.length > 0);

  // Untracked: latest value per raw_name.
  const untrackedMap = new Map<string, UntrackedMarker>();
  for (const r of untrackedRows.sort((a, b) => a.measured_at.localeCompare(b.measured_at))) {
    untrackedMap.set(r.raw_name.toLowerCase(), {
      raw_name: r.raw_name,
      value: r.canonical_value ?? r.value ?? null,
      unit: r.unit,
      date: r.measured_at,
    });
  }

  return {
    series,
    attention,
    recentlyChanged,
    byPanel,
    untracked: [...untrackedMap.values()],
    totalConfirmedReports,
  };
}
