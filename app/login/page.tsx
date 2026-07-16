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
    <main className="container" style={{ maxWidth: 460, paddingTop: 'var(--sp-8)' }}>
      <div className="eyebrow">Family health record</div>
      <h1>Longitudinal blood-test tracking</h1>
      <p className="muted">Sign in to manage your family&apos;s lab results.</p>
      {sent ? (
        <div className="card">Check your email for a secure sign-in link.</div>
      ) : (
        <form className="card stack" onSubmit={sendLink}>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="label">Email</span>
            <input
              className="input"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <div>
            <button className="btn" type="submit">Send magic link</button>
          </div>
          {error && <p className="small" style={{ color: 'var(--flag-high)', margin: 0 }}>{error}</p>}
        </form>
      )}
    </main>
  );
}
