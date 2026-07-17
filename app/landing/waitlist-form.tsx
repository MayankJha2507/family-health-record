'use client';

import { useState } from 'react';

/**
 * Early-access email capture. Standalone marketing form — it does NOT write to
 * any app table or the pipeline. For now it validates and confirms client-side;
 * wiring it to a real waitlist store/email service is a small later step.
 */
export function WaitlistForm({ id }: { id: string }) {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!ok) { setError(true); return; }
    setError(false);
    setDone(true);
  }

  if (done) {
    return (
      <div className="waitlist done" role="status">
        <span className="waitlist-check" aria-hidden>✓</span>
        You’re on the list — we’ll email <strong>{email.trim()}</strong> when early access opens.
      </div>
    );
  }

  return (
    <form className="waitlist" onSubmit={submit} noValidate>
      <label htmlFor={id} className="sr-only">Email address</label>
      <input
        id={id}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        aria-invalid={error}
        onChange={(e) => { setEmail(e.target.value); setError(false); }}
        className="waitlist-input"
      />
      <button type="submit" className="btn waitlist-btn">Get early access</button>
      {error && <p className="waitlist-err" role="alert">Please enter a valid email address.</p>}
    </form>
  );
}
