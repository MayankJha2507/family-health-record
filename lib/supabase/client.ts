'use client';

import { createBrowserClient } from '@supabase/ssr';

/** Browser-side Supabase client. RLS applies; only the anon key is used. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
