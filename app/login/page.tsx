'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import './login.css';

/* Supabase phrases this differently across versions; match broadly so toggling
   signups off in the dashboard shows a friendly message, not a raw API error. */
const CLOSED_SIGNUP_RE = /signups? (are )?(not allowed|disabled)/i;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setSending(false);
    if (error) {
      setError(
        CLOSED_SIGNUP_RE.test(error.message)
          ? 'Sign-ups are currently closed. Please check back soon.'
          : error.message,
      );
    } else {
      setSent(true);
    }
  }

  return (
    <main className="login-root">
      <div className="login-panel">
        <Link href="/landing" className="login-brand">
          <span className="login-logo" aria-hidden />
          Family Vitals
        </Link>

        {sent ? (
          <div className="login-card login-sent" role="status">
            <span className="login-check" aria-hidden>✓</span>
            <h1>Check your email</h1>
            <p>
              We sent a secure sign-in link to <strong>{email}</strong>. Open it on this
              device to continue.
            </p>
            <button className="login-alt" type="button" onClick={() => setSent(false)}>
              Use a different email
            </button>
          </div>
        ) : (
          <div className="login-card">
            <h1>Sign in</h1>
            <p className="login-sub">
              We&rsquo;ll email you a secure magic link — no password to remember.
            </p>
            <form onSubmit={sendLink}>
              <label htmlFor="login-email" className="login-label">Email</label>
              <input
                id="login-email"
                className="login-input"
                type="email"
                required
                autoFocus
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button className="btn login-btn" type="submit" disabled={sending}>
                {sending ? 'Sending…' : 'Email me a magic link'}
              </button>
              {error && <p className="login-err" role="alert">{error}</p>}
            </form>
          </div>
        )}

        <p className="login-fineprint">
          Private to your family — encrypted in transit and at rest.
        </p>
      </div>
    </main>
  );
}
