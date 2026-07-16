import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { buildProfileTrends, type ResultRow } from '@/lib/trends/build';
import { TrendsView } from './trends-view';

/** Phase 2: a family member's longitudinal view, triaged by attention. */
export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, relation')
    .eq('id', id)
    .single();
  if (!profile) {
    return (
      <main className="container">
        <div className="card"><h3>Profile not found</h3><Link href="/" className="link">← Family</Link></div>
      </main>
    );
  }

  // Confirmed results only (health facts), newest report metadata for the count.
  const { data: rowsRaw } = await supabase
    .from('results')
    .select('raw_name, value, canonical_value, canonical_unit, unit, ref_low, ref_high, flag, measured_at, biomarkers(code)')
    .eq('profile_id', id)
    .order('measured_at', { ascending: true });

  const { count: reportCount } = await supabase
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', id)
    .eq('status', 'confirmed');

  const rows: ResultRow[] = (rowsRaw ?? []).map((r) => ({
    code: (r.biomarkers as { code?: string } | null)?.code ?? null,
    raw_name: r.raw_name,
    value: r.value,
    canonical_value: r.canonical_value,
    canonical_unit: r.canonical_unit,
    unit: r.unit,
    ref_low: r.ref_low,
    ref_high: r.ref_high,
    flag: r.flag,
    measured_at: r.measured_at,
  }));

  const trends = buildProfileTrends(rows, reportCount ?? 0);

  return (
    <main className="container">
      <div className="between" style={{ marginBottom: 'var(--sp-5)' }}>
        <div>
          <div className="eyebrow">Family Vitals</div>
          <h1 style={{ marginBottom: 2 }}>{profile.name}</h1>
          <p className="muted small" style={{ margin: 0 }}>
            {profile.relation ? `${profile.relation} · ` : ''}
            {trends.totalConfirmedReports} confirmed report{trends.totalConfirmedReports === 1 ? '' : 's'}
          </p>
        </div>
        <div className="row" style={{ gap: 'var(--sp-3)' }}>
          <Link href="/upload" className="btn btn-secondary btn-sm">Upload a report</Link>
          <Link href="/" className="link">← Family</Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>No confirmed results yet</h3>
          <p className="muted">Upload a blood test and confirm it to start building {profile.name}&apos;s trends.</p>
          <Link href="/upload" className="btn">Upload a report</Link>
        </div>
      ) : (
        <TrendsView trends={trends} />
      )}
    </main>
  );
}
