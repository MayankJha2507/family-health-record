import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { UploadForm } from './upload-form';

/** Gate 2a: pick a family member, upload a blood-test PDF, watch it process. */
export default async function UploadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, relation')
    .order('created_at', { ascending: true });

  return (
    <main className="container">
      <div className="between" style={{ marginBottom: 'var(--sp-5)' }}>
        <div>
          <div className="eyebrow">Add a report</div>
          <h1>Upload a blood test</h1>
        </div>
        <Link href="/" className="link">← Family</Link>
      </div>

      {profiles && profiles.length > 0 ? (
        <UploadForm userId={user.id} profiles={profiles} />
      ) : (
        <div className="card">
          <h3>No family members yet</h3>
          <p className="muted">Add a family member before uploading a report.</p>
          <Link href="/" className="btn" style={{ marginTop: 'var(--sp-2)' }}>Add a family member</Link>
        </div>
      )}
    </main>
  );
}
