import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createProfile, signOut } from './actions';

const STATUS_LABEL: Record<string, string> = {
  processing: 'Processing',
  needs_review: 'Ready to review',
  confirmed: 'Confirmed',
  failed: 'Failed',
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: profiles }, { data: reports }] = await Promise.all([
    supabase.from('profiles').select('id, name, relation').order('created_at', { ascending: true }),
    supabase
      .from('reports')
      .select('id, profile_id, status, lab_name, collected_at, created_at, profiles(name)')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  return (
    <main className="container">
      <div className="between" style={{ marginBottom: 'var(--sp-6)' }}>
        <div>
          <div className="eyebrow">Family Vitals</div>
          <h1>Your family</h1>
          <p className="muted small">Signed in as {user.email}</p>
        </div>
        <form action={signOut}>
          <button type="submit" className="btn-ghost btn">Sign out</button>
        </form>
      </div>

      <div className="between" style={{ marginBottom: 'var(--sp-3)' }}>
        <h2 style={{ margin: 0 }}>Members</h2>
        {profiles && profiles.length > 0 && (
          <Link href="/upload" className="btn">Upload a report</Link>
        )}
      </div>

      {profiles && profiles.length > 0 ? (
        <div className="card" style={{ padding: 'var(--sp-2)' }}>
          {profiles.map((p, i) => (
            <Link
              key={p.id}
              href={`/profiles/${p.id}`}
              className="between profile-link"
              style={{ padding: 'var(--sp-3) var(--sp-4)', borderTop: i ? '1px solid var(--border)' : 'none' }}
            >
              <div>
                <strong>{p.name}</strong>
                {p.relation && <span className="muted small"> · {p.relation}</span>}
              </div>
              <span className="link small">View trends →</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="muted">No family members yet. Add your first below.</p>
      )}

      {reports && reports.length > 0 && (
        <>
          <h2 style={{ marginTop: 'var(--sp-6)' }}>Recent reports</h2>
          <div className="card" style={{ padding: 'var(--sp-2)' }}>
            {reports.map((r, i) => {
              const profileName = (r.profiles as { name?: string } | null)?.name ?? '—';
              const href = r.status === 'needs_review' ? `/reports/${r.id}/review` : `/profiles/${r.profile_id}`;
              return (
                <Link
                  key={r.id}
                  href={href}
                  className="between profile-link"
                  style={{ padding: 'var(--sp-3) var(--sp-4)', borderTop: i ? '1px solid var(--border)' : 'none' }}
                >
                  <div>
                    <strong>{r.lab_name ?? 'Blood test'}</strong>
                    <span className="muted small"> · {profileName}</span>
                    <div className="faint small numeric">
                      {r.collected_at ?? new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="row">
                    <span className={`pill ${r.status}`}><span className="dot" />{STATUS_LABEL[r.status] ?? r.status}</span>
                    <span className="link small">{r.status === 'needs_review' ? 'Review →' : 'View trends →'}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      <hr className="divider" />

      <form action={createProfile} className="card stack">
        <h3 style={{ marginTop: 0 }}>Add a family member</h3>
        <label className="field">
          <span className="label">Name</span>
          <input className="input" name="name" required placeholder="e.g. Priya Sharma" />
        </label>
        <div className="row" style={{ alignItems: 'flex-end', gap: 'var(--sp-3)' }}>
          <label className="field" style={{ flex: 1, marginBottom: 0 }}>
            <span className="label">Relation</span>
            <input className="input" name="relation" placeholder="mother, self…" />
          </label>
          <label className="field" style={{ flex: 1, marginBottom: 0 }}>
            <span className="label">Date of birth</span>
            <input className="input" name="dob" type="date" />
          </label>
          <label className="field" style={{ flex: 1, marginBottom: 0 }}>
            <span className="label">Sex</span>
            <select className="select" name="sex" defaultValue="">
              <option value="">—</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </label>
        </div>
        <div>
          <button className="btn" type="submit">Add member</button>
        </div>
      </form>
    </main>
  );
}
