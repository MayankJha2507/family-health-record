# Family Longitudinal Health Record

Track family blood-test biomarkers over time from Indian diagnostic-lab PDFs.
**Not a diagnostic tool** — it flags values outside the lab's printed range so you
can discuss them with a doctor.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/SCHEMA.md`](docs/SCHEMA.md),
and [`docs/OUT-OF-SCOPE.md`](docs/OUT-OF-SCOPE.md) for the build plan and the MVP contract.

## Status: Phase 0 (foundations)

Done: docs, Next.js scaffold, magic-link auth, Postgres schema + RLS, biomarker
dictionary seed, and an RLS isolation test. **Not** done (Phase 1): the extraction
pipeline (Groq/Gemini) and review screen.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + keys
```

Apply the schema to your Supabase project (migrations are the source of truth):

```bash
# with the Supabase CLI linked to your project:
supabase db push
```

Run the dev server:

```bash
npm run dev
```

## Prove RLS isolation (the Phase 0 gate)

Boots a throwaway local Postgres (no Docker), applies the real migrations, and
asserts two users cannot read/insert/update/delete each other's data:

```bash
npm run test:rls
```

Phase 0 is not complete unless this passes.
