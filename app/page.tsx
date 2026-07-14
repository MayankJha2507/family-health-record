import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createProfile, signOut } from './actions';

/**
 * Family dashboard. The profiles query carries no WHERE clause — RLS scopes it
 * to the signed-in owner. That's the Phase 0 contract, exercised in the UI.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, relation, dob, sex')
    .order('created_at', { ascending: true });

  return (
    <main>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1>Your family</h1>
        <form action={signOut}>
          <button type="submit" style={{ background: 'transparent', color: 'var(--muted)', borderColor: 'var(--border)' }}>
            Sign out
          </button>
        </form>
      </div>
      <p className="muted">Signed in as {user.email}</p>

      {profiles && profiles.length > 0 ? (
        profiles.map((p) => (
          <div key={p.id} className="card">
            <strong>{p.name}</strong>
            {p.relation && <span className="muted"> · {p.relation}</span>}
          </div>
        ))
      ) : (
        <p className="muted">No family members yet. Add your first below.</p>
      )}

      <form action={createProfile} className="card" style={{ marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Add a family member</h2>
        <input name="name" required placeholder="Name" style={{ width: '100%', marginBottom: '0.5rem' }} />
        <input name="relation" placeholder="Relation (e.g. mother, self)" style={{ width: '100%', marginBottom: '0.5rem' }} />
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input name="dob" type="date" style={{ flex: 1 }} />
          <select name="sex" style={{ flex: 1, padding: '0.55rem', borderRadius: 8, border: '1px solid var(--border)' }}>
            <option value="">Sex…</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </div>
        <button type="submit">Add member</button>
      </form>
    </main>
  );
}
