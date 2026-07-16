/**
 * DEV-ONLY login bypass. Auto-signs-in a fixed local dev user so we can test the
 * app without the magic-link round-trip. HARD-GATED: returns 404 unless
 * DEV_AUTH_BYPASS=true AND not production. Never ships to real users — remove the
 * env flag before launch and normal magic-link auth resumes.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

const DEV_EMAIL = 'dev@familyvitals.local';
const DEV_PW = 'dev-only-local-password-2026';

function bypassEnabled() {
  return process.env.DEV_AUTH_BYPASS === 'true' && process.env.NODE_ENV !== 'production';
}

export async function GET(request: NextRequest) {
  if (!bypassEnabled()) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  // Ensure the dev user exists with a known password (service role).
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email === DEV_EMAIL);
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, { password: DEV_PW, email_confirm: true });
  } else {
    await admin.auth.admin.createUser({ email: DEV_EMAIL, password: DEV_PW, email_confirm: true });
  }

  // Sign in via the cookie-bound server client so the session is persisted.
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: DEV_EMAIL, password: DEV_PW });
  if (error) {
    return NextResponse.json({ error: `dev sign-in failed: ${error.message}` }, { status: 500 });
  }

  // Seed one demo family member so the upload flow is testable immediately.
  const { data: profiles } = await supabase.from('profiles').select('id').limit(1);
  if (!profiles || profiles.length === 0) {
    await supabase.from('profiles').insert({ name: 'Priya Sharma', relation: 'mother', sex: 'female' });
  }

  return NextResponse.redirect(new URL('/', request.url));
}
