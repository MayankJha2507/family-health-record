# Data Model & RLS — Family Longitudinal Health Record

Postgres on Supabase. Migrations live in `supabase/migrations/` and are the single
source of truth; this document explains intent. The biomarker dictionary is seeded
**via migration** (not `seed.sql`) so `supabase db push` applies it to the hosted
project too.

## Tables

### `profiles` — family members (not app users)
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| owner_id | uuid → auth.users | defaults to `auth.uid()`; the ONLY ownership root |
| name | text | required |
| dob | date | for age display; no age-based ranges in MVP |
| sex | text | `male \| female \| other` |
| relation | text | free text: "mother", "self", … |

### `reports` — one uploaded PDF (or manual-entry session)
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| profile_id | uuid → profiles | cascade delete |
| storage_path | text | null for manual entry |
| lab_name | text | as printed on the report |
| collected_at | date | **sample collection date — the timeline key** |
| reported_at | date | lab's reporting date (display only) |
| status | text | `processing → needs_review → confirmed` \| `failed` |
| parser_used | text | `groq \| gemini \| manual` |
| raw_extraction | jsonb | raw LLM output, kept forever for re-normalization |

### `biomarkers` — canonical dictionary (~58 rows, seeded)
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| code | text unique | stable snake_case key, e.g. `alt`, `hba1c` |
| display_name | text | e.g. "ALT (SGPT)" |
| category | text | CBC, Lipid, LFT, KFT, Thyroid, Glucose, Vitamins, Iron, Inflammation |
| canonical_unit | text | unit trends are charted in |

### `biomarker_aliases` — lab-name → canonical mapping (the moat)
| column | type | notes |
|---|---|---|
| biomarker_id | uuid → biomarkers | cascade delete |
| alias | text | lowercase; unique on `lower(alias)` |

Matching at runtime: lowercase, trim, collapse whitespace/punctuation, look up here.
No match ⇒ result stored with `biomarker_id NULL` (kept raw, listed honestly, not
trended).

### `results` — one analyte value from one report
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| report_id | uuid → reports | cascade delete |
| profile_id | uuid → profiles | denormalized for cheap RLS + trend queries; trigger enforces it matches the report's profile |
| biomarker_id | uuid → biomarkers, nullable | null = unmatched analyte |
| raw_name | text | exactly as printed on the PDF |
| value / unit | numeric / text | as printed |
| canonical_value / canonical_unit | numeric / text | converted in code, never by LLM |
| ref_low / ref_high / ref_text | numeric / numeric / text | **the lab's own printed range**; ref_text for non-numeric ranges ("<200", "Negative") |
| flag | text | `low \| normal \| high \| abnormal`, computed in code vs. the lab range |
| measured_at | date | copied from report `collected_at`; charts read this |
| entered_manually | boolean | manual entry vs. extracted |

Indexes: `results(profile_id, biomarker_id, measured_at)` (trend query),
`reports(profile_id)`, `profiles(owner_id)`, unique `lower(alias)`.

## RLS — one policy shape everywhere

Ownership root is `profiles.owner_id = auth.uid()`. Everything else derives from it
by joining to `profiles`:

- `profiles`: select/insert/update/delete where `owner_id = (select auth.uid())`;
  insert also `with check`.
- `reports`, `results`: all four operations gated on
  `exists (select 1 from profiles p where p.id = profile_id and p.owner_id = (select auth.uid()))`.
- `biomarkers`, `biomarker_aliases`: read-only to `authenticated`; **no write
  policies** — only migrations/service role write the dictionary.
- A trigger on `results` forces `profile_id` to match the parent report's
  `profile_id`, so the denormalized column can't lie.

`(select auth.uid())` (not bare `auth.uid()`) so Postgres evaluates it once per
statement, not per row.

## Storage

Private bucket `reports`. Object path: `{owner_uid}/{report_id}.pdf`.
Policies on `storage.objects`: owner-only select/insert/update/delete where
`(storage.foldername(name))[1] = auth.uid()::text`. (Guarded in the migration so it
also runs on plain Postgres in local tests, where `storage` doesn't exist.)

## Verification

`npm run test:rls` boots a throwaway local Postgres (embedded-postgres), stubs the
`auth` schema the way Supabase provides it, applies these exact migrations, then
proves as two different authenticated users that neither can read, insert into,
update, or delete the other's rows — and that the dictionary is readable but not
writable. Phase 0 is not done unless this passes.
