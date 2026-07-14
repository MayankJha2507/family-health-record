'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Insert a family profile. owner_id is intentionally NOT set here — the column
 * defaults to auth.uid() and the RLS insert policy enforces it, so the server
 * can never write a profile for anyone but the signed-in user.
 */
export async function createProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;

  await supabase.from('profiles').insert({
    name,
    relation: (String(formData.get('relation') ?? '').trim()) || null,
    dob: (String(formData.get('dob') ?? '')) || null,
    sex: (String(formData.get('sex') ?? '')) || null,
  });

  revalidatePath('/');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
