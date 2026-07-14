# Architecture — Family Longitudinal Health Record

**Product:** Users create profiles for family members and upload blood-test PDFs from any
Indian diagnostic lab. The app extracts structured biomarker data, normalizes it across
labs, stores it longitudinally, and shows per-biomarker trends plus a doctor-ready
printable summary. It **never diagnoses** — abnormal values are flagged only as
"discuss with your doctor."

## Stack (fixed)

| Layer | Choice | Notes |
|---|---|---|
| App + hosting | Next.js (App Router) on Vercel | UI + API routes in one codebase |
| DB / Auth / Storage | Supabase (Postgres + RLS) | Single source of truth |
| Text structuring | **Groq** | Text-only, high rate limits → digital-PDF path |
| Vision extraction | **Gemini** | Rate-limited → scanned/image PDFs ONLY |

Access model: **one account owns many family profiles.** No sharing, no multi-user
families in MVP.

## Extraction pipeline (Phase 1)

```
Upload (Next.js) ──► Supabase Storage (private bucket, path scoped to user id)
      │
      ▼
API route: create reports row (status=processing), then:
  1. Extract PDF text layer server-side (unpdf / pdf-parse)
  2. ROUTE BY STRENGTH:
     • Real text layer (≥ ~200 chars/page incl. digits) ──► GROQ
       text → structured JSON, page-chunked, JSON mode
     • Scanned/image PDF ──► GEMINI
       render pages → images → vision extraction
       sequential pages + retry/backoff (rate-limited resource)
  3. Both paths emit the SAME JSON schema:
     { lab, collected_at, results: [{ name, value, unit,
       ref_low, ref_high, ref_text, page }] }
  4. Deterministic post-processing IN CODE, never the LLM:
     alias → canonical biomarker match, unit conversion,
     numeric sanity bounds, date parsing
      │
      ▼
status=needs_review ──► Review screen (PDF beside editable table)
      │ user confirms/edits (this table doubles as the manual-entry form)
      ▼
results rows committed ──► trends, dashboard, doctor export
```

### Pipeline rules (non-negotiable)

1. **LLMs transcribe; code calculates.** Unit conversion, range comparison, and
   flagging are deterministic functions against the biomarker dictionary. Never let
   an LLM convert units or compute flags.
2. **Never discard the raw extraction.** The LLM's raw JSON is stored on
   `reports.raw_extraction`. Improved prompts/dictionaries can re-normalize old
   reports without re-calling the APIs.
3. **No value becomes health data without human confirmation.** Every report lands
   on the review screen; nothing auto-commits.
4. **Timeline key is `collected_at` (sample collection date), never report date.**
   Labs report days late; multi-lab timelines skew otherwise.
5. **Reference ranges are per-result, from the lab's own PDF.** Ranges are
   method-dependent; flag against the lab's printed range, not a canonical one.

### Vercel execution model

Process synchronously in a route handler with a high `maxDuration` (fluid compute
allows 300s); the client polls `reports.status`. No queue infrastructure at family
volume. Gemini pages are processed sequentially with backoff.

## Biomarker normalization

A curated canonical dictionary (~58 analytes: CBC, lipid, LFT, KFT, thyroid,
glucose/HbA1c, vitamins, iron — see `supabase/migrations/`) with an aliases table
mapping lab-specific names ("SGPT", "S.G.P.T (ALT)", "Alanine Aminotransferase") to
one canonical biomarker. **The aliases table is the moat** — it grows with every
weird lab PDF. Analytes that don't match stay stored raw (`results.biomarker_id IS
NULL`) and appear in an honest "found but not trended yet" list; they are never
silently dropped.

## Phases

- **Phase 0 (current):** repo, docs, Next.js scaffold, auth, schema + RLS,
  biomarker dictionary seed. Done when RLS provably blocks cross-user access.
- **Phase 1:** extraction pipeline + review screen + golden-set eval script
  (15–20 real family PDFs across labs; every prompt tweak regression-tested).
- **Phase 2:** longitudinal views — profile dashboard, per-biomarker trend charts
  with each point's own lab-range band.
- **Phase 3:** doctor summary as print-stylesheet page (browser print-to-PDF),
  duplicate-upload detection, failed-extraction fallback to manual entry.
- **Phase 4:** friends beta, only after 2–3 weeks of real family use.

## Safety posture

Persistent non-diagnostic disclaimer. Flags read "discuss with your doctor."
No LLM-generated medical prose in MVP. Launch audience is own family, then friends;
DPDP-Act compliance work is deferred until the audience grows beyond friends.
