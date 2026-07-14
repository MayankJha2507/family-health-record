/**
 * Phase 0 gate: prove RLS isolates one account's family data from another's.
 *
 * Boots a throwaway local Postgres (embedded-postgres, no Docker), applies the
 * Supabase shim + the real migrations in supabase/migrations, then acts as two
 * different authenticated users and asserts that neither can read, insert,
 * update, or delete the other's rows — and that the biomarker dictionary is
 * readable but not writable by end users.
 *
 * Run: npm run test:rls
 */
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import EmbeddedPostgres from 'embedded-postgres';
import { Client } from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

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

/** Run a callback as an authenticated user: set role + JWT sub claim, always reset. */
async function asUser<T>(db: Client, userId: string, fn: () => Promise<T>): Promise<T> {
  // Session scope (is_local=false): pg autocommits each query in its own
  // transaction, so a transaction-local GUC would vanish before the next call.
  await db.query('set role authenticated');
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [
    JSON.stringify({ sub: userId, role: 'authenticated' }),
  ]);
  try {
    return await fn();
  } finally {
    await db.query('reset role');
    await db.query(`select set_config('request.jwt.claims', '', false)`);
  }
}

/** Assert a statement is blocked (0 rows affected under RLS, or a raised error). */
async function expectBlocked(
  db: Client,
  userId: string,
  label: string,
  sql: string,
  params: unknown[] = [],
) {
  const outcome = await asUser(db, userId, async () => {
    try {
      const r = await db.query(sql, params);
      return { rows: r.rowCount ?? 0, error: null as string | null };
    } catch (e) {
      return { rows: 0, error: (e as Error).message };
    }
  });
  check(label, outcome.rows === 0, outcome.error ? `error: ${outcome.error}` : `affected ${outcome.rows} row(s)`);
}

async function main() {
  const dataDir = mkdtempSync(join(tmpdir(), 'flhr-pg-'));
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port: 54329,
    persistent: false,
  });

  await pg.initialise();
  await pg.start();
  await pg.createDatabase('flhr_test');

  const db = new Client({
    host: 'localhost',
    port: 54329,
    user: 'postgres',
    password: 'postgres',
    database: 'flhr_test',
  });
  await db.connect();

  try {
    // --- Apply shim + migrations, in order --------------------------------
    const shim = readFileSync(join(__dirname, 'supabase-shim.sql'), 'utf8');
    await db.query(shim);

    const migDir = join(ROOT, 'supabase', 'migrations');
    const migrations = readdirSync(migDir).filter((f) => f.endsWith('.sql')).sort();
    for (const file of migrations) {
      await db.query(readFileSync(join(migDir, file), 'utf8'));
    }
    console.log(`Applied shim + ${migrations.length} migration(s): ${migrations.join(', ')}\n`);

    // --- Seed two users, each with a profile + report + result ------------
    // Inserted as the superuser (bypasses RLS) to set up the fixture.
    const [alice, bob] = ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'];
    await db.query(`insert into auth.users (id, email) values ($1,'alice@test'), ($2,'bob@test')`, [alice, bob]);

    async function seedFamily(owner: string, who: string) {
      const p = await db.query(
        `insert into public.profiles (owner_id, name, sex, relation) values ($1,$2,'female','self') returning id`,
        [owner, who],
      );
      const profileId = p.rows[0].id;
      const r = await db.query(
        `insert into public.reports (profile_id, lab_name, collected_at, status, parser_used)
         values ($1,'Dr Lal PathLabs','2026-05-01','confirmed','manual') returning id`,
        [profileId],
      );
      const reportId = r.rows[0].id;
      const bm = await db.query(`select id from public.biomarkers where code='hba1c'`);
      const res = await db.query(
        `insert into public.results (report_id, profile_id, biomarker_id, raw_name, value, unit, measured_at)
         values ($1,$2,$3,'HbA1c',5.4,'%','2026-05-01') returning id`,
        [reportId, profileId, bm.rows[0].id],
      );
      return { profileId, reportId, resultId: res.rows[0].id };
    }

    const A = await seedFamily(alice, 'Alice');
    const B = await seedFamily(bob, 'Bob');

    // --- Sanity: dictionary seeded ----------------------------------------
    console.log('Dictionary seed');
    const bmCount = (await db.query(`select count(*)::int n from public.biomarkers`)).rows[0].n;
    const aliasCount = (await db.query(`select count(*)::int n from public.biomarker_aliases`)).rows[0].n;
    check(`biomarkers seeded (${bmCount})`, bmCount >= 55);
    check(`aliases seeded (${aliasCount})`, aliasCount >= 100);

    // --- Each user sees exactly their own ---------------------------------
    console.log('\nOwn-data visibility');
    for (const [uid, name, ids] of [[alice, 'Alice', A], [bob, 'Bob', B]] as const) {
      const rows = await asUser(db, uid, async () => {
        const p = await db.query(`select id from public.profiles`);
        const r = await db.query(`select id from public.reports`);
        const res = await db.query(`select id from public.results`);
        return { p: p.rows.length, r: r.rows.length, res: res.rows.length };
      });
      check(`${name} sees own profile/report/result (1/1/1)`, rows.p === 1 && rows.r === 1 && rows.res === 1,
        `got ${rows.p}/${rows.r}/${rows.res}`);
    }

    // --- SELECT isolation --------------------------------------------------
    console.log('\nCross-user SELECT is blocked');
    const aliceSeesBob = await asUser(db, alice, async () => {
      const p = await db.query(`select id from public.profiles where id=$1`, [B.profileId]);
      const r = await db.query(`select id from public.reports where id=$1`, [B.reportId]);
      const res = await db.query(`select id from public.results where id=$1`, [B.resultId]);
      return p.rows.length + r.rows.length + res.rows.length;
    });
    check('Alice cannot SELECT any of Bob\'s profile/report/result', aliceSeesBob === 0, `saw ${aliceSeesBob} row(s)`);

    // --- INSERT isolation: cannot write into another's profile ------------
    console.log('\nCross-user INSERT is blocked');
    await expectBlocked(db, alice, 'Alice cannot INSERT a report under Bob\'s profile',
      `insert into public.reports (profile_id, lab_name, status, parser_used) values ($1,'evil','processing','manual')`,
      [B.profileId]);
    await expectBlocked(db, alice, 'Alice cannot INSERT a result under Bob\'s profile',
      `insert into public.results (report_id, profile_id, raw_name, value, measured_at)
       values ($1,$2,'evil',9.9,'2026-05-01')`,
      [B.reportId, B.profileId]);
    // Forge attempt: claim ownership by setting owner_id to Bob while acting as Alice.
    await expectBlocked(db, alice, 'Alice cannot INSERT a profile owned by Bob (forged owner_id)',
      `insert into public.profiles (owner_id, name) values ($1,'forged')`, [bob]);

    // --- UPDATE isolation --------------------------------------------------
    console.log('\nCross-user UPDATE is blocked');
    await expectBlocked(db, alice, 'Alice cannot UPDATE Bob\'s profile',
      `update public.profiles set name='hacked' where id=$1`, [B.profileId]);
    await expectBlocked(db, alice, 'Alice cannot UPDATE Bob\'s result value',
      `update public.results set value=0 where id=$1`, [B.resultId]);

    // --- DELETE isolation --------------------------------------------------
    console.log('\nCross-user DELETE is blocked');
    await expectBlocked(db, alice, 'Alice cannot DELETE Bob\'s report',
      `delete from public.reports where id=$1`, [B.reportId]);
    await expectBlocked(db, alice, 'Alice cannot DELETE Bob\'s profile',
      `delete from public.profiles where id=$1`, [B.profileId]);

    // Confirm Bob's data survived every attack above.
    const bobIntact = (await db.query(
      `select (select count(*) from public.profiles where id=$1)
            + (select count(*) from public.reports where id=$2)
            + (select count(*) from public.results where id=$3) as n`,
      [B.profileId, B.reportId, B.resultId],
    )).rows[0].n;
    check('Bob\'s rows are intact after all of Alice\'s attempts', Number(bobIntact) === 3, `found ${bobIntact}/3`);

    // --- Dictionary is read-only to end users -----------------------------
    console.log('\nBiomarker dictionary is read-only');
    const canRead = await asUser(db, alice, async () =>
      (await db.query(`select count(*)::int n from public.biomarkers`)).rows[0].n);
    check('Alice CAN read the biomarker dictionary', canRead >= 55, `read ${canRead}`);
    await expectBlocked(db, alice, 'Alice cannot INSERT into biomarkers',
      `insert into public.biomarkers (code, display_name, category, canonical_unit) values ('x','X','Y','z')`);
    await expectBlocked(db, alice, 'Alice cannot UPDATE biomarkers',
      `update public.biomarkers set display_name='x' where code='hba1c'`);

    // --- Trigger integrity: denormalized profile_id cannot lie ------------
    console.log('\nDenormalization guard');
    const triggerHeld = await asUser(db, alice, async () => {
      try {
        // Alice owns A; try to attach a result to her report but stamp Bob's profile_id.
        await db.query(
          `insert into public.results (report_id, profile_id, raw_name, value, measured_at)
           values ($1,$2,'mismatch',1,'2026-05-01')`,
          [A.reportId, B.profileId],
        );
        return false; // should not reach here
      } catch {
        return true;
      }
    });
    check('results.profile_id mismatching its report is rejected', triggerHeld);
  } finally {
    await db.end();
    await pg.stop();
    rmSync(dataDir, { recursive: true, force: true });
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
