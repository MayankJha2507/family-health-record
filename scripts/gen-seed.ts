/**
 * Generate the biomarker seed migration from the TypeScript dictionary — the
 * single source of truth. Run after editing lib/biomarkers/dictionary.ts:
 *
 *   npm run gen:seed
 *
 * Keeps supabase/migrations/00003_seed_biomarkers.sql in lockstep with the
 * pipeline's in-memory dictionary so the DB and the parser can never disagree.
 */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BIOMARKERS } from '../lib/biomarkers/dictionary';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'supabase', 'migrations', '00003_seed_biomarkers.sql');

function sql(s: string): string {
  return s.replace(/'/g, "''");
}

const bmRows = BIOMARKERS.map(
  (b) => `  ('${sql(b.code)}', '${sql(b.display_name)}', '${sql(b.category)}', '${sql(b.canonical_unit)}')`,
).join(',\n');

const aliasRows = BIOMARKERS.flatMap((b) =>
  b.aliases.map((a) => `  ('${sql(b.code)}', '${sql(a)}')`),
).join(',\n');

const header = `-- GENERATED FILE — do not edit by hand.
-- Source of truth: lib/biomarkers/dictionary.ts. Regenerate with: npm run gen:seed
--
-- Seeds the canonical biomarker dictionary + lab-name aliases via MIGRATION (not
-- seed.sql) so \`supabase db push\` applies it to the hosted project too.
-- Idempotent: safe to re-run. Aliases are lowercase (check + unique-on-lower index).
`;

const body = `${header}
insert into public.biomarkers (code, display_name, category, canonical_unit) values
${bmRows}
on conflict (code) do update
  set display_name   = excluded.display_name,
      category       = excluded.category,
      canonical_unit = excluded.canonical_unit;

insert into public.biomarker_aliases (biomarker_id, alias)
select b.id, a.alias
from (values
${aliasRows}
) as a(code, alias)
join public.biomarkers b on b.code = a.code
on conflict (lower(alias)) do nothing;
`;

writeFileSync(OUT, body);
const aliasCount = BIOMARKERS.reduce((n, b) => n + b.aliases.length, 0);
console.log(`Wrote ${OUT}`);
console.log(`  ${BIOMARKERS.length} biomarkers, ${aliasCount} aliases`);
