'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main>
      <h1>Family Longitudinal Health Record</h1>
      <p className="muted">Sign in to manage your family&apos;s lab results.</p>
      {sent ? (
        <div className="card">Check your email for a sign-in link.</div>
      ) : (
        <form className="card" onSubmit={sendLink}>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', marginBottom: '0.75rem' }}
          />
          <button type="submit">Send magic link</button>
          {error && <p style={{ color: '#b3261e' }}>{error}</p>}
        </form>
      )}
    </main>
  );
}
