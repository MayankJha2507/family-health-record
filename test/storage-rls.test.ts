/**
 * Gate 2 hard gate: prove Supabase STORAGE isolation on the REAL project.
 *
 * The Phase 0 embedded-Postgres test could not exercise the storage schema, so
 * this runs against your actual Supabase project: it creates two throwaway users
 * and proves user B cannot read, list, sign, overwrite, or delete user A's PDF —
 * same standing as the Phase 0 RLS gate. Nothing uploads in the app until this
 * passes.
 *
 *   npm run test:storage-rls
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY   (admin — creates/deletes the two test users)
 * And the migrations (esp. 00002_storage.sql: private "reports" bucket + policies)
 * applied to the project.
 *
 * Object path convention (matches the app): {owner_uid}/{report_id}.pdf
 * The storage policies gate every op on (storage.foldername(name))[1] = auth.uid().
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(join(__dirname, '..', '.env.local'));
} catch {
  /* env may be provided by the shell */
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = 'reports';

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? `  — ${detail}` : ''}`);
  }
}

function requireEnv() {
  const missing = [
    ['NEXT_PUBLIC_SUPABASE_URL', URL],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', ANON],
    ['SUPABASE_SERVICE_ROLE_KEY', SERVICE],
  ].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    console.error(`Cannot run: missing ${missing.join(', ')} in .env.local.`);
    console.error('Connect your Supabase project and apply the migrations first.');
    process.exit(2);
  }
}

/** A client signed in as a specific user (RLS applies as that user). */
async function signInAs(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(URL!, ANON!, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return client;
}

async function main() {
  requireEnv();
  const admin = createClient(URL!, SERVICE!, { auth: { persistSession: false } });

  // --- Preconditions: private bucket must exist (from 00002_storage.sql) ----
  const { data: bucket, error: bErr } = await admin.storage.getBucket(BUCKET);
  if (bErr || !bucket) {
    console.error(`Bucket "${BUCKET}" not found (${bErr?.message ?? 'missing'}).`);
    console.error('Apply supabase/migrations/00002_storage.sql to your project first.');
    process.exit(2);
  }
  check(`bucket "${BUCKET}" is PRIVATE (public=false)`, bucket.public === false,
    `public=${bucket.public} — a public bucket bypasses RLS`);

  // --- Create two throwaway confirmed users -------------------------------
  const stamp = Date.now();
  const pw = `Test-${stamp}-pw!`;
  const users: { label: string; email: string; id: string }[] = [];
  for (const label of ['A', 'B']) {
    const email = `rls-${label.toLowerCase()}-${stamp}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email, password: pw, email_confirm: true,
    });
    if (error || !data.user) throw new Error(`createUser ${label} failed: ${error?.message}`);
    users.push({ label, email, id: data.user.id });
  }
  const [A, B] = users;
  const aPath = `${A.id}/probe-${stamp}.pdf`;      // A's file, under A's uid folder
  const fileA = new Blob([`pdf-bytes-of-${A.label}`], { type: 'application/pdf' });

  const aClient = await signInAs(A.email, pw);
  const bClient = await signInAs(B.email, pw);
  const anon = createClient(URL!, ANON!, { auth: { persistSession: false } }); // no session

  try {
    // --- A can write and read its own file --------------------------------
    console.log('\nOwner (A) can use its own folder');
    const up = await aClient.storage.from(BUCKET).upload(aPath, fileA, { upsert: false });
    check('A uploads to its own folder', !up.error, up.error?.message);
    const aRead = await aClient.storage.from(BUCKET).download(aPath);
    check('A downloads its own file', !aRead.error && !!aRead.data, aRead.error?.message);

    // --- B cannot READ A's file -------------------------------------------
    console.log('\nCross-user reads are blocked');
    const bRead = await bClient.storage.from(BUCKET).download(aPath);
    check("B cannot download A's file", !!bRead.error && !bRead.data, 'download unexpectedly succeeded');

    const bList = await bClient.storage.from(BUCKET).list(A.id);
    check("B cannot list A's folder (RLS hides rows)",
      !bList.error ? (bList.data?.length ?? 0) === 0 : true,
      `listed ${bList.data?.length ?? 0} item(s)`);

    const bSign = await bClient.storage.from(BUCKET).createSignedUrl(aPath, 60);
    check("B cannot create a signed URL for A's file", !!bSign.error && !bSign.data,
      'signed URL unexpectedly issued');

    // --- Anonymous (no session) cannot read A's file ----------------------
    const anonRead = await anon.storage.from(BUCKET).download(aPath);
    check("anonymous cannot download A's file", !!anonRead.error && !anonRead.data,
      'download unexpectedly succeeded');

    // --- B cannot WRITE into A's folder -----------------------------------
    console.log('\nCross-user writes are blocked');
    const bUp = await bClient.storage.from(BUCKET)
      .upload(`${A.id}/evil-${stamp}.pdf`, new Blob(['x']), { upsert: false });
    check("B cannot upload into A's folder", !!bUp.error, 'upload unexpectedly succeeded');

    const bOver = await bClient.storage.from(BUCKET).upload(aPath, new Blob(['tampered']), { upsert: true });
    check("B cannot overwrite A's file", !!bOver.error, 'overwrite unexpectedly succeeded');

    const bDel = await bClient.storage.from(BUCKET).remove([aPath]);
    // remove() returns data listing successfully-removed objects; RLS => none removed.
    const removedByB = !bDel.error && Array.isArray(bDel.data) && bDel.data.length > 0;
    check("B cannot delete A's file", !removedByB, 'delete unexpectedly removed the object');

    // --- A's file survived every attack -----------------------------------
    const stillThere = await aClient.storage.from(BUCKET).download(aPath);
    const bytes = stillThere.data ? await stillThere.data.text() : '';
    check("A's file is intact and unchanged after all of B's attempts",
      !stillThere.error && bytes === `pdf-bytes-of-${A.label}`, `content="${bytes}"`);
  } finally {
    // --- Cleanup (service role) -------------------------------------------
    await admin.storage.from(BUCKET).remove([aPath, `${A.id}/evil-${stamp}.pdf`]).catch(() => {});
    for (const u of users) await admin.auth.admin.deleteUser(u.id).catch(() => {});
    await aClient.auth.signOut().catch(() => {});
    await bClient.auth.signOut().catch(() => {});
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
